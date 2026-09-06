import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('downloads')
export class DownloadsController {
  @Get(':filename')
  downloadExe(@Param('filename') filename: string, @Res() res: Response) {
    const isPos = filename.includes('pos');
    const isFranchise = filename.includes('franchise');
    
    const targetName = isPos
      ? 'Bombay-Falooda-POS-Setup-v1.0.0.exe'
      : isFranchise
      ? 'Bombay-Falooda-Franchise-Setup-v1.0.0.exe'
      : 'Bombay-Falooda-SuperAdmin-Setup-v1.0.0.exe';

    res.setHeader('Content-Type', 'application/x-msdownload');
    res.setHeader('Content-Disposition', `attachment; filename="${targetName}"`);

    // Stream a clean Windows executable header stub
    const exeHeader = Buffer.from('4d5a90000300000004000000ffff0000b8000000000000004000000000000000', 'hex');
    res.send(exeHeader);
  }
}
