# Backend Structure

## Applications

- `apps/api`: HTTP API used by website, Superadmin, Franchise Owner portal and POS.
- `apps/worker`: background process for scheduled jobs and integrations.

## Libraries

- `libs/config`: environment and configuration loading.
- `libs/database`: database connection and repositories.
- `libs/auth`: authentication helpers.
- `libs/permissions`: role and permission utilities.
- `libs/notifications`: Firebase Cloud Messaging utilities.
- `libs/whatsapp`: Meta WhatsApp Cloud API utilities.
- `libs/audit`: sensitive action logging utilities.

## Business Modules

- `users`
- `franchises`
- `outlets`
- `menus`
- `pos`
- `orders`
- `billing`
- `kot`
- `reports`
- `delivery-assistance`
- `integrations`
