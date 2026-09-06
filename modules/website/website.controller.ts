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

  @Get('orders/history')
  orderHistory(@Query('phone') phone?: string, @Query('email') email?: string) {
    return this.websiteService.getCustomerOrderHistory(phone, email);
  }

  @Get('razorpay/key')
  getRazorpayKey() {
    return this.websiteService.getRazorpayKey();
  }

  @Post('razorpay/create-order')
  createRazorpayOrder(@Body() body: { amount: number; currency?: string }) {
    return this.websiteService.createRazorpayOrder(body.amount, body.currency);
  }

  @Post('auth/google')
  googleAuth(@Body() body: { credential?: string; email?: string; name?: string }) {
    return this.websiteService.googleLogin(body.credential, body.email, body.name);
  }
}
