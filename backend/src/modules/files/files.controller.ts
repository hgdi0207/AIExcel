import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { FilesService } from './files.service';
import type { AuthUser } from '../../shared/auth.types';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async upload(@Req() request: Request & { user?: AuthUser }, @UploadedFile() file?: any) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const workbook = await this.filesService.createWorkbookFromUpload(user.id, file, user.plan);

    return {
      success: true,
      data: {
        workbook,
      },
    };
  }

  @Get()
  async list(@Req() request: Request & { user?: AuthUser }) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: {
        items: await this.filesService.listWorkbooks(user.id),
      },
    };
  }

  @Get(':id/preview')
  async preview(@Req() request: Request & { user?: AuthUser }, @Param('id') id: string) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: await this.filesService.getWorkbookPreview(id, user.id),
    };
  }
}
