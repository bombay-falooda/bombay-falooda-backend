import { PosDeviceType } from '@prisma/client';

export type PosSession = {
  posDeviceId: string;
  outletId: string;
  franchiseId: string | null;
  type: PosDeviceType;
};

export type PosJwtPayload = PosSession & {
  sessionType: 'POS';
};
