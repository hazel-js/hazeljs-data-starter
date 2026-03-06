/**
 * UserIngestionPipeline - ETL for user profile data
 *
 * Demonstrates @Pipeline, @Transform, @Validate:
 * 1. normalize - Lowercase email, trim fields
 * 2. validate - Schema (email, age range)
 * 3. sanitize - Remove sensitive fields, add metadata
 */
import {
  Pipeline,
  PipelineBase,
  Transform,
  Validate,
  ETLService,
  Schema,
  Injectable,
  Redact,
} from '@hazeljs/data';

export interface RawUser {
  email?: string;
  name?: string;
  age?: number;
  role?: string;
  internalId?: string;
}

export interface ProcessedUser {
  email: string;
  name: string;
  age: number;
  role: string;
  ingestedAt: string;
}

const UserSchema = Schema.object({
  email: Schema.string().email(),
  name: Schema.string().min(1).max(200),
  age: Schema.number().min(0).max(150),
  role: Schema.string().oneOf(['user', 'admin', 'moderator', 'guest']),
});

@Pipeline('user-ingestion')
@Injectable()
export class UserIngestionPipeline extends PipelineBase {
  constructor(etlService: ETLService) {
    super(etlService);
  }

  @Transform({ step: 1, name: 'normalize' })
  async normalize(data: unknown): Promise<RawUser> {
    const raw = data as RawUser;
    return {
      email: (raw.email ?? '').toString().trim().toLowerCase(),
      name: (raw.name ?? '').toString().trim(),
      age: Math.max(0, Math.min(150, Number(raw.age) || 0)),
      role: (raw.role ?? 'user').toString().toLowerCase().trim(),
      internalId: raw.internalId,
    };
  }

  @Validate({
    step: 2,
    name: 'validate',
    schema: UserSchema,
  })
  async validate(data: unknown): Promise<RawUser> {
    return data as RawUser;
  }

  @Transform({ step: 3, name: 'sanitize' })
  @Redact({ fields: ['internalId'] })
  async sanitize(data: RawUser): Promise<ProcessedUser> {
    return {
      email: data.email ?? '',
      name: data.name ?? '',
      age: data.age ?? 0,
      role: data.role ?? 'user',
      ingestedAt: new Date().toISOString(),
    };
  }
}
