-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN_2FA', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT;

-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN     "closingTime" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "onlineOrderingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "openingTime" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "serviceRadiusKm" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "PosDevice" ADD COLUMN     "eventLocation" TEXT,
ADD COLUMN     "handlerName" TEXT,
ADD COLUMN     "handlerPhone" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MenuAddonGroup" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuAddonGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuAddon" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRoute" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL,
    "posDeviceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KotTicketItem" (
    "id" TEXT NOT NULL,
    "kotTicketId" TEXT NOT NULL,
    "billItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "KotTicketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outletId" TEXT,
    "posDeviceId" TEXT,
    "canEditMenu" BOOLEAN NOT NULL DEFAULT false,
    "canEditBill" BOOLEAN NOT NULL DEFAULT false,
    "canCancelBill" BOOLEAN NOT NULL DEFAULT false,
    "canApplyDiscount" BOOLEAN NOT NULL DEFAULT false,
    "canReprintBill" BOOLEAN NOT NULL DEFAULT false,
    "canViewReports" BOOLEAN NOT NULL DEFAULT false,
    "canRouteOrders" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuAddonGroup_itemId_idx" ON "MenuAddonGroup"("itemId");

-- CreateIndex
CREATE INDEX "MenuAddon_groupId_idx" ON "MenuAddon"("groupId");

-- CreateIndex
CREATE INDEX "OrderRoute_posDeviceId_idx" ON "OrderRoute"("posDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRoute_outletId_source_key" ON "OrderRoute"("outletId", "source");

-- CreateIndex
CREATE INDEX "KotTicketItem_billItemId_idx" ON "KotTicketItem"("billItemId");

-- CreateIndex
CREATE UNIQUE INDEX "KotTicketItem_kotTicketId_billItemId_key" ON "KotTicketItem"("kotTicketId", "billItemId");

-- CreateIndex
CREATE INDEX "AuthOtp_userId_idx" ON "AuthOtp"("userId");

-- CreateIndex
CREATE INDEX "AuthOtp_purpose_idx" ON "AuthOtp"("purpose");

-- CreateIndex
CREATE INDEX "AuthOtp_expiresAt_idx" ON "AuthOtp"("expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_revokedAt_idx" ON "UserSession"("revokedAt");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE INDEX "UserPermission_outletId_idx" ON "UserPermission"("outletId");

-- CreateIndex
CREATE INDEX "UserPermission_posDeviceId_idx" ON "UserPermission"("posDeviceId");

-- CreateIndex
CREATE INDEX "Bill_cancelledById_idx" ON "Bill"("cancelledById");

-- AddForeignKey
ALTER TABLE "MenuAddonGroup" ADD CONSTRAINT "MenuAddonGroup_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuAddon" ADD CONSTRAINT "MenuAddon_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MenuAddonGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRoute" ADD CONSTRAINT "OrderRoute_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRoute" ADD CONSTRAINT "OrderRoute_posDeviceId_fkey" FOREIGN KEY ("posDeviceId") REFERENCES "PosDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotTicketItem" ADD CONSTRAINT "KotTicketItem_kotTicketId_fkey" FOREIGN KEY ("kotTicketId") REFERENCES "KotTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotTicketItem" ADD CONSTRAINT "KotTicketItem_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "BillItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthOtp" ADD CONSTRAINT "AuthOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_posDeviceId_fkey" FOREIGN KEY ("posDeviceId") REFERENCES "PosDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
