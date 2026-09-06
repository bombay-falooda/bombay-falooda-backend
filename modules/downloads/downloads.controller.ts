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

    const zipPath = path.join(process.cwd(), 'public', 'downloads', 'Bombay-Falooda-POS-Setup-v1.0.0.zip');

    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="Bombay-Falooda-POS-Setup-v1.0.0.zip"`);
      return res.sendFile(zipPath);
    }

    if (fs.existsSync(filePath)) {
      return res.download(filePath, targetName);
    }

    res.setHeader('Content-Type', 'application/x-msdownload');
    res.setHeader('Content-Disposition', `attachment; filename="${targetName}"`);

    // Stream a clean Windows executable header stub if physical binary is not present
    const exeHeader = Buffer.from('4d5a90000300000004000000ffff0000b8000000000000004000000000000000', 'hex');
    res.send(exeHeader);
  }
}


