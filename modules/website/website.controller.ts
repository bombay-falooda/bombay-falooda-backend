import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CreateWebsiteOrderDto } from './dto/create-website-order.dto';
import { WebsiteService } from './website.service';

@Controller('website')
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get('outlets')
  outlets(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    return this.websiteService.outlets(lat, lng);
  }

  @Get('outlets/:id/menu')
  menu(@Param('id') id: string) {
    return this.websiteService.menu(id);
  }

  @Post('orders')
  createOrder(@Body() dto: CreateWebsiteOrderDto) {
    return this.websiteService.createOrder(dto);
  }
}
