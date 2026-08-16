import { UserRole } from '../enums';

export type JwtUser = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: UserRole;
  franchiseId?: string | null;
  outletId?: string | null;
  sessionId?: string;
};
