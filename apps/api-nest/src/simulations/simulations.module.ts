import { Module } from '@nestjs/common';
import { SimulationsController } from './simulations.controller';
import { SimulationReviewController } from './simulation-review.controller';
import { TeacherSessionsController } from './teacher-sessions.controller';
import { SimulationsService } from './simulations.service';
import { SimulationInstanceService } from './simulation-instance.service';
import { AIService } from './ai/ai.service';
import { OpenAiService } from './ai/openai.service';
import { CrisisEngine } from './engines/crisis-engine.service';
import { CatalogModule } from '../catalog/catalog.module';
import { RbacModule } from '../rbac/rbac.module';
import { RubricsModule } from '../rubrics/rubrics.module';
import { SessionMemoryService } from './session-memory.service';
import { AsyncPersistenceService } from './async-persistence.service';
import { SessionCheckpointService } from './session-checkpoint.service';
import { TriggerService } from './triggers/trigger.service';
import { EmailTrigger } from './triggers/email.trigger';
import { CrisisTrigger } from './triggers/crisis.trigger';
import { Trigger } from './triggers/trigger.interface';
import { ConversationStateService } from './conversation-state.service';
import { PracticesService } from './practices.service';
import { PracticesController } from './practices.controller';
import { AssetDispatcherService } from './assets/asset-dispatcher.service';

@Module({
  imports: [CatalogModule, RbacModule, RubricsModule],
  controllers: [
    SimulationsController,
    SimulationReviewController,
    TeacherSessionsController,
    PracticesController,
  ],
  providers: [
    SimulationsService,
    SimulationInstanceService,
    OpenAiService,
    AIService,
    CrisisEngine,
    SessionMemoryService,
    AsyncPersistenceService,
    SessionCheckpointService,
    ConversationStateService,
    PracticesService,
    EmailTrigger,
    CrisisTrigger,
    AssetDispatcherService,
    {
      provide: TriggerService,
      useFactory: (
        emailTrigger: EmailTrigger,
        crisisTrigger: CrisisTrigger,
        sessionMemory: SessionMemoryService,
      ) => {
        const triggers: Trigger[] = [emailTrigger, crisisTrigger];
        return new TriggerService(triggers, sessionMemory);
      },
      inject: [EmailTrigger, CrisisTrigger, SessionMemoryService],
    },
  ],
  exports: [
    SimulationsService,
    SimulationInstanceService,
    AIService,
    OpenAiService,
    CrisisEngine,
    SessionMemoryService,
    AsyncPersistenceService,
    SessionCheckpointService,
    ConversationStateService,
    TriggerService,
    PracticesService,
    AssetDispatcherService,
  ],
})
export class SimulationsModule {}
