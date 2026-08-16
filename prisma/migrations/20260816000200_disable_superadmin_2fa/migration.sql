UPDATE "User"
SET "twoFactorEnabled" = false,
    "twoFactorSecret" = NULL,
    "twoFactorMethod" = NULL
WHERE "role" = 'SUPERADMIN';
