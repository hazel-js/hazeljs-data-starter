/**
 * OrderProcessingPipeline - ETL for e-commerce orders
 *
 * Demonstrates @Pipeline, @Transform, @Validate with Schema:
 * 1. normalize - Trim strings, lowercase status
 * 2. validate - Schema validation (required fields, types)
 * 3. enrich - Add computed fields (total, tax, formatted date)
 */
import {
  Pipeline,
  PipelineBase,
  Transform,
  Validate,
  ETLService,
  Schema,
  Injectable,
} from '@hazeljs/data';

export interface RawOrder {
  id?: string;
  customerId?: string;
  items?: Array<{ sku?: string; qty?: number; price?: number }>;
  status?: string;
  createdAt?: string;
}

export interface ProcessedOrder {
  id: string;
  customerId: string;
  items: Array<{ sku: string; qty: number; price: number; subtotal: number }>;
  status: string;
  total: number;
  tax: number;
  createdAt: string;
  processedAt: string;
}

const OrderItemSchema = Schema.object({
  sku: Schema.string().min(1),
  qty: Schema.number().min(1),
  price: Schema.number().min(0),
});

const OrderSchema = Schema.object({
  id: Schema.string().min(1),
  customerId: Schema.string().min(1),
  items: Schema.array(OrderItemSchema),
  status: Schema.string().oneOf(['pending', 'paid', 'shipped', 'delivered', 'cancelled']),
  createdAt: Schema.string().min(1),
});

@Pipeline('order-processing')
@Injectable()
export class OrderProcessingPipeline extends PipelineBase {
  constructor(etlService: ETLService) {
    super(etlService);
  }

  @Transform({ step: 1, name: 'normalize' })
  async normalize(data: unknown): Promise<RawOrder> {
    const raw = data as RawOrder;
    return {
      id: (raw.id ?? '').toString().trim(),
      customerId: (raw.customerId ?? '').toString().trim(),
      items: (raw.items ?? []).map((item) => ({
        sku: (item.sku ?? '').toString().trim(),
        qty: Math.max(0, Number(item.qty) || 0),
        price: Math.max(0, Number(item.price) || 0),
      })),
      status: (raw.status ?? 'pending').toString().toLowerCase().trim(),
      createdAt: (raw.createdAt ?? '').toString().trim(),
    };
  }

  @Validate({
    step: 2,
    name: 'validate',
    schema: OrderSchema,
  })
  async validate(data: unknown): Promise<RawOrder> {
    return data as RawOrder;
  }

  @Transform({
    step: 3,
    name: 'enrich',
    when: (d) => (d as RawOrder).status !== 'cancelled',
  })
  async enrich(data: RawOrder): Promise<ProcessedOrder> {
    const itemList = data.items ?? [];
    const items = itemList.map((item) => ({
      sku: item.sku ?? '',
      qty: item.qty ?? 0,
      price: item.price ?? 0,
      subtotal: (item.qty ?? 0) * (item.price ?? 0),
    }));
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    const tax = Math.round(subtotal * 0.1 * 100) / 100;
    const total = subtotal + tax;

    return {
      id: data.id ?? '',
      customerId: data.customerId ?? '',
      items,
      status: data.status ?? 'pending',
      total,
      tax,
      createdAt: data.createdAt ?? '',
      processedAt: new Date().toISOString(),
    };
  }

  @Transform({ step: 4, name: 'finalize' })
  async finalize(data: RawOrder | ProcessedOrder): Promise<ProcessedOrder> {
    const d = data as ProcessedOrder & RawOrder;
    if ('total' in d && typeof d.total === 'number') {
      return d as ProcessedOrder;
    }
    return {
      id: d.id ?? '',
      customerId: d.customerId ?? '',
      items: (d.items ?? []).map((item) => ({
        sku: item.sku ?? '',
        qty: item.qty ?? 0,
        price: item.price ?? 0,
        subtotal: (item.qty ?? 0) * (item.price ?? 0),
      })),
      status: d.status ?? 'pending',
      total: 0,
      tax: 0,
      createdAt: d.createdAt ?? '',
      processedAt: new Date().toISOString(),
    };
  }
}
