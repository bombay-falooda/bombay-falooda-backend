-- CreateEnum
CREATE TYPE "MenuSetupStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'PUBLISHED', 'LOCKED');

-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN     "menuEditingLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "menuEditingUnlockedUntil" TIMESTAMP(3),
ADD COLUMN     "menuSetupStatus" "MenuSetupStatus" NOT NULL DEFAULT 'NOT_STARTED';
