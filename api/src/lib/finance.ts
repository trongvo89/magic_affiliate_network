import { PrismaClient } from '@prisma/client'

// Recalculate a publisher's balance from ActOrders
export async function recalculatePublisherBalance(prisma: PrismaClient, publisherId: string): Promise<void> {
  const orders = await prisma.actOrder.findMany({
    where: { publisherId },
    select: { payout: true, finalStatus: true, paymentStatus: true },
  })

  // Determine currency from first order that has one, default USD
  const firstOrder = await prisma.actOrder.findFirst({
    where: { publisherId },
    select: { currency: true },
  })
  const currency = firstOrder?.currency ?? 'USD'

  let pendingAmount = 0
  let approvedAmount = 0
  let availableAmount = 0
  let requestedAmount = 0
  let paidAmount = 0
  let holdAmount = 0

  for (const order of orders) {
    const p = order.payout ?? 0
    if (order.finalStatus === 'PENDING') pendingAmount += p
    if (order.finalStatus === 'APPROVED') approvedAmount += p
    if (order.paymentStatus === 'PAYABLE') availableAmount += p
    if (order.paymentStatus === 'REQUESTED' || order.paymentStatus === 'PROCESSING') requestedAmount += p
    if (order.paymentStatus === 'PAID') paidAmount += p
    if (order.finalStatus === 'HOLD' || order.paymentStatus === 'HOLD') holdAmount += p
  }

  await prisma.$transaction([
    prisma.publisherBalance.upsert({
      where: { publisherId },
      update: { currency, pendingAmount, approvedAmount, availableAmount, requestedAmount, paidAmount, holdAmount },
      create: { publisherId, currency, pendingAmount, approvedAmount, availableAmount, requestedAmount, paidAmount, holdAmount },
    }),
  ])
}

// Release publisher payables for an act (called after advertiser payment received)
export async function releasePublisherPayables(prisma: PrismaClient, actId: string): Promise<void> {
  const orders = await prisma.actOrder.findMany({
    where: { actId, finalStatus: 'APPROVED', paymentStatus: 'NOT_PAYABLE_YET' },
    select: { id: true, publisherId: true },
  })

  if (orders.length === 0) return

  const orderIds = orders.map(o => o.id)
  const uniquePublisherIds = [...new Set(orders.map(o => o.publisherId).filter((id): id is string => id !== null))]

  await prisma.actOrder.updateMany({
    where: { id: { in: orderIds } },
    data: { paymentStatus: 'PAYABLE' },
  })

  for (const publisherId of uniquePublisherIds) {
    await recalculatePublisherBalance(prisma, publisherId)
  }
}

// Record advertiser payment and update invoice status
export async function recordAdvertiserPayment(
  prisma: PrismaClient,
  invoiceId: string,
  data: {
    amount: number
    currency: string
    paymentDate: Date
    paymentMethod?: string
    transactionReference?: string
    proofFileUrl?: string
    notes?: string
    createdBy: string
  }
): Promise<void> {
  const invoice = await prisma.advertiserInvoice.findUnique({
    where: { id: invoiceId },
    include: { act: true },
  })
  if (!invoice) throw new Error('Invoice not found')

  await prisma.advertiserPayment.create({
    data: {
      invoiceId,
      advertiserId: invoice.advertiserId,
      amount: data.amount,
      currency: data.currency,
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod ?? null,
      transactionReference: data.transactionReference ?? null,
      proofFileUrl: data.proofFileUrl ?? null,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
    },
  })

  const aggregate = await prisma.advertiserPayment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  })
  const totalPaid = aggregate._sum.amount ?? 0

  let newInvoiceStatus: 'RECEIVED' | 'PARTIALLY_RECEIVED' | null = null
  let newAdvPayStatus: 'PAID' | 'PARTIAL' | null = null

  if (totalPaid >= invoice.amount) {
    newInvoiceStatus = 'RECEIVED'
    newAdvPayStatus = 'PAID'
  } else if (totalPaid > 0) {
    newInvoiceStatus = 'PARTIALLY_RECEIVED'
    newAdvPayStatus = 'PARTIAL'
  }

  if (newInvoiceStatus) {
    await prisma.$transaction([
      prisma.advertiserInvoice.update({
        where: { id: invoiceId },
        data: { status: newInvoiceStatus },
      }),
      prisma.settlementAct.update({
        where: { id: invoice.actId },
        data: { advertiserPaymentStatus: newAdvPayStatus! },
      }),
    ])

    if (newInvoiceStatus === 'RECEIVED') {
      await releasePublisherPayables(prisma, invoice.actId)
    }
  }
}

// Approve a publisher payment request
export async function approvePublisherPaymentRequest(prisma: PrismaClient, requestId: string, adminId: string): Promise<void> {
  await prisma.publisherPaymentRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', approvedAt: new Date() },
  })
}

// Reject a publisher payment request
export async function rejectPublisherPaymentRequest(prisma: PrismaClient, requestId: string, adminId: string, reason: string): Promise<void> {
  const request = await prisma.publisherPaymentRequest.findUnique({
    where: { id: requestId },
    include: { items: { where: { status: 'INCLUDED' }, select: { id: true, actOrderId: true, publisherId: true } } },
  })
  if (!request) throw new Error('Payment request not found')

  const actOrderIds = request.items.map(i => i.actOrderId)
  const uniquePublisherIds = [...new Set(request.items.map(i => i.publisherId))]

  await prisma.$transaction([
    prisma.publisherPaymentRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', adminNote: reason },
    }),
    prisma.actOrder.updateMany({
      where: { id: { in: actOrderIds } },
      data: { paymentStatus: 'PAYABLE' },
    }),
    prisma.publisherPaymentItem.updateMany({
      where: { paymentRequestId: requestId, status: 'INCLUDED' },
      data: { status: 'CANCELLED' },
    }),
  ])

  for (const publisherId of uniquePublisherIds) {
    await recalculatePublisherBalance(prisma, publisherId)
  }
}

// Mark publisher payment as paid
export async function markPublisherPaymentPaid(prisma: PrismaClient, requestId: string, adminId: string, proofUrl?: string): Promise<void> {
  const request = await prisma.publisherPaymentRequest.findUnique({
    where: { id: requestId },
    include: { items: { select: { id: true, actOrderId: true, publisherId: true } } },
  })
  if (!request) throw new Error('Payment request not found')

  const actOrderIds = request.items.map(i => i.actOrderId)
  const uniquePublisherIds = [...new Set(request.items.map(i => i.publisherId))]

  const updateData: any = { status: 'PAID', paidAt: new Date() }
  if (proofUrl) updateData.paymentProofUrl = proofUrl

  await prisma.$transaction([
    prisma.publisherPaymentRequest.update({
      where: { id: requestId },
      data: updateData,
    }),
    prisma.publisherPaymentItem.updateMany({
      where: { paymentRequestId: requestId },
      data: { status: 'PAID' },
    }),
    prisma.actOrder.updateMany({
      where: { id: { in: actOrderIds } },
      data: { paymentStatus: 'PAID' },
    }),
  ])

  for (const publisherId of uniquePublisherIds) {
    await recalculatePublisherBalance(prisma, publisherId)
  }
}
