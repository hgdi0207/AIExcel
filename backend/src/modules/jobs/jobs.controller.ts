import {
  ConflictException,
  Controller,
  Get,
  Param,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JobsService } from './jobs.service';
import type { AuthUser } from '../../shared/auth.types';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get(':id/status')
  async status(@Req() request: Request & { user?: AuthUser }, @Param('id') id: string) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const job = await this.jobsService.getJobForUser(id, user.id);
    return {
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
      },
    };
  }

  @Get(':id/result')
  async result(@Req() request: Request & { user?: AuthUser }, @Param('id') id: string) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const job = await this.jobsService.getJobForUser(id, user.id);
    if (job.status !== 'completed') {
      throw new ConflictException('Job result not ready');
    }

    return {
      success: true,
      data: {
        jobId: job.id,
        kind: job.kind,
        result: job.result,
      },
    };
  }

  @Get(':id/stream')
  async stream(
    @Req() request: Request & { user?: AuthUser },
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const job = await this.jobsService.getJobForUser(id, user.id);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    response.write(
      `event: job.progress\ndata: ${JSON.stringify({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
      })}\n\n`,
    );

    setTimeout(() => {
      void (async () => {
        const latest = await this.jobsService.getJobForUser(id, user.id);
        response.write(
          `event: job.complete\ndata: ${JSON.stringify({
            jobId: latest.id,
            status: latest.status,
            progress: latest.progress,
          })}\n\n`,
        );
        response.end();
      })();
    }, 300);
  }
}
