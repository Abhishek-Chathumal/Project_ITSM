import { Module } from '@nestjs/common';
import { PriorityResolverService } from './priority-resolver.service';

/**
 * The request module, ahead of the routes that will live in it.
 *
 * Slice 2b delivers the data model and the two pieces of logic that read it — priority
 * derivation (Ref B3) and the operational-state predicate (Ref B5). The controllers, DTOs
 * and `applyScope()`-backed queries are Slice 3, and deliberately not here: Slice 3 must
 * not start before Phase 0's access-control work, and an empty module is a much clearer
 * marker of that boundary than a half-built controller.
 *
 * Registered in `AppModule` now rather than with Slice 3 so that dependency injection for
 * `PriorityResolverService` is exercised at boot. An `@Injectable()` nobody provides
 * type-checks, passes its unit tests, and fails the first time it is actually resolved —
 * which is the runtime-only failure mode this project keeps meeting.
 */
@Module({
  providers: [PriorityResolverService],
  exports: [PriorityResolverService],
})
export class RequestsModule {}
