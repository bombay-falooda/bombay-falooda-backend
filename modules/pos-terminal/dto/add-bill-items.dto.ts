import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';

import { BillItemInputDto } from './bill-item-input.dto';

export class AddBillItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillItemInputDto)
  items!: BillItemInputDto[];
}
