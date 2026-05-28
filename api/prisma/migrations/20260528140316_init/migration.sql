-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PUBLISHER');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MmpSource" AS ENUM ('APPSFLYER', 'ADJUST');

-- CreateEnum
CREATE TYPE "CommType" AS ENUM ('FLAT_CPA', 'PERCENT_REVENUE');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "ConvStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PUBLISHER',
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "postbackUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "mmpSource" "MmpSource" NOT NULL,
    "commissionType" "CommType" NOT NULL DEFAULT 'FLAT_CPA',
    "commissionValue" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "OfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "sourceType" "MmpSource" NOT NULL,
    "sourceRefId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "publisherId" TEXT,
    "eventType" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ConvStatus" NOT NULL DEFAULT 'PENDING',
    "rawPayload" JSONB NOT NULL,
    "postbackSent" BOOLEAN NOT NULL DEFAULT false,
    "postbackSentAt" TIMESTAMP(3),
    "postbackStatus" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_appId_key" ON "Offer"("appId");

-- CreateIndex
CREATE INDEX "Conversion_publisherId_eventAt_idx" ON "Conversion"("publisherId", "eventAt" DESC);

-- CreateIndex
CREATE INDEX "Conversion_offerId_status_idx" ON "Conversion"("offerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_sourceType_sourceRefId_key" ON "Conversion"("sourceType", "sourceRefId");

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
