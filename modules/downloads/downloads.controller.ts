import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('downloads')
export class DownloadsController {
  @Get(':filename')
  downloadExe(@Param('filename') filename: string, @Res() res: Response) {
    const lower = filename.toLowerCase();
    const isPos = lower.includes('pos');
    const isFranchise = lower.includes('franchise');
    
    const targetName = isPos
      ? 'Bombay-Falooda-POS-Setup-v1.0.0.exe'
      : isFranchise
      ? 'Bombay-Falooda-Franchise-Setup-v1.0.0.exe'
      : 'Bombay-Falooda-SuperAdmin-Setup-v1.0.0.exe';

    const filePath = path.join(process.cwd(), 'public', 'downloads', targetName);

    if (fs.existsSync(filePath)) {
      return res.download(filePath, targetName);
    }

    const RELEASE_BASE = 'https://github.com/bombay-falooda/bombay-falooda-desktop/releases/download/v1.0.0';
    const remoteUrl = isPos
      ? `${RELEASE_BASE}/Bombay-Falooda-POS-Setup.exe`
      : isFranchise
      ? `${RELEASE_BASE}/Bombay-Falooda-Franchise-Setup.exe`
      : `${RELEASE_BASE}/Bombay-Falooda-SuperAdmin-Setup.exe`;

    return res.redirect(302, remoteUrl);
  }
}


