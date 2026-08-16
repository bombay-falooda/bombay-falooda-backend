ALTER TABLE "Outlet"
DROP COLUMN IF EXISTS "deliveryBaseDistanceKm",
DROP COLUMN IF EXISTS "deliveryBaseCharge",
DROP COLUMN IF EXISTS "deliveryPerKmCharge",
ADD COLUMN IF NOT EXISTS "outletBaseCharge" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "deliveryKmPricing" JSONB;
