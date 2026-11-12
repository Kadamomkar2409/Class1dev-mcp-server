import { Module } from '@nitrostack/core';
import { Class1Tools } from './class1.tools.js';
import { RecordService } from '../../services/record.service.js';
import { HealthService } from '../../services/health.service.js';
import { Class1EngineService } from '../../services/class1-engine.service.js';

/**
 * Class1Module
 * Packages the Class1Dev MCP tools and services into a modular NitroStack domain.
 */
@Module({
  name: 'class1',
  description: 'Class1Dev AI Cost Governance & Persistent Record MCP Module',
  controllers: [
    Class1Tools,
  ],
  providers: [
    RecordService,
    HealthService,
    Class1EngineService,
  ],
  exports: [
    RecordService,
    HealthService,
    Class1EngineService,
  ],
})
export class Class1Module {}


