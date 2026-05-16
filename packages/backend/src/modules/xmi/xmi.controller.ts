/**
 * @emf-webapp/backend — XmiController
 *
 * Endpoints para exportar/importar metamodelos en formato
 * XMI 2.0 compatible con Eclipse EMF (.ecore).
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  Body,
  NotFoundException,
  BadRequestException,
  Logger,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import AdmZip = require('adm-zip');
import { XmiService } from './xmi.service.js';
import type { XmiInstanceDocument } from '@emf-webapp/core/serialization';

@Controller('projects/:projectId/xmi')
export class XmiController {
  private readonly logger = new Logger(XmiController.name);

  constructor(private readonly xmiService: XmiService) {}

  /**
   * GET /projects/:projectId/xmi/:metamodelId/ecore
   * Exporta el metamodelo como archivo .ecore (XMI 2.0).
   */
  @Get(':metamodelId/ecore')
  async exportEcore(
    @Param('projectId') projectId: string,
    @Param('metamodelId') metamodelId: string,
    @Res() res: Response,
  ): Promise<void> {
    const xmi = await this.xmiService.exportToXmi(projectId, metamodelId);
    if (!xmi) throw new NotFoundException('Metamodel not found');

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${metamodelId}.ecore"`);
    res.send(xmi);
  }

  /**
   * GET /projects/:projectId/xmi/:metamodelId/genmodel
   * Exporta el archivo .genmodel compatible con Eclipse.
   */
  @Get(':metamodelId/genmodel')
  async exportGenmodel(
    @Param('projectId') projectId: string,
    @Param('metamodelId') metamodelId: string,
    @Res() res: Response,
  ): Promise<void> {
    const genmodel = await this.xmiService.exportGenmodel(projectId, metamodelId);
    if (!genmodel) throw new NotFoundException('Metamodel not found');

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${metamodelId}.genmodel"`);
    res.send(genmodel);
  }

  /**
   * GET /projects/:projectId/xmi/:metamodelId/zip
   * Exporta un proyecto Eclipse completo como ZIP importable.
   * Estructura:
   *   {pluginId}/
   *   ├── .project
   *   ├── .classpath
   *   ├── META-INF/MANIFEST.MF
   *   ├── build.properties
   *   ├── plugin.xml
   *   ├── model/{name}.ecore
   *   └── model/{name}.genmodel
   */
  @Get(':metamodelId/zip')
  async exportZip(
    @Param('projectId') projectId: string,
    @Param('metamodelId') metamodelId: string,
    @Res() res: Response,
  ): Promise<void> {
    const eclipseZip = await this.xmiService.exportEclipseProject(projectId, metamodelId);
    if (!eclipseZip) throw new NotFoundException('Metamodel not found');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${metamodelId}-eclipse.zip"`);
    res.send(eclipseZip);
  }

  /**
   * POST /projects/:projectId/xmi/:metamodelId/import
   * Importa un archivo .ecore (XMI 2.0) de Eclipse.
   * Acepta el XML en el body (text/plain o application/xml).
   */
  @Post(':metamodelId/import')
  async importEcore(
    @Param('projectId') projectId: string,
    @Param('metamodelId') metamodelId: string,
    @Body() body: { xml: string } | string,
  ): Promise<{ success: boolean; message: string }> {
    const xml = typeof body === 'string' ? body : body?.xml;
    if (!xml) {
      throw new BadRequestException('XML content is required. Send { xml: "..." } or raw XML string.');
    }
    const result = await this.xmiService.importFromXmi(projectId, metamodelId, xml);
    return { success: result, message: result ? 'Metamodel imported successfully' : 'Import failed' };
  }

  /**
   * POST /projects/:projectId/xmi/:metamodelId/import-eclipse-zip
   * Importa un proyecto Eclipse completo (ZIP con .ecore dentro).
   * Acepta multipart/form-data con campo 'file'.
   */
  @Post(':metamodelId/import-eclipse-zip')
  @UseInterceptors(FileInterceptor('file'))
  async importEclipseZip(
    @Param('projectId') projectId: string,
    @Param('metamodelId') metamodelId: string,
    @UploadedFile() file: any,
  ): Promise<{ success: boolean; message: string; ecoreFile?: string }> {
    if (!file) {
      throw new BadRequestException('ZIP file is required. Upload as multipart/form-data with field "file".');
    }

    try {
      const zip = new AdmZip(file.buffer);
      const entries = zip.getEntries();

      // Find .ecore file in the ZIP
      const ecoreEntry = entries.find((e: any) => e.entryName.endsWith('.ecore') && !e.isDirectory);
      if (!ecoreEntry) {
        throw new BadRequestException('No .ecore file found in the ZIP archive.');
      }

      const ecoreXml = ecoreEntry.getData().toString('utf-8');
      const result = await this.xmiService.importFromXmi(projectId, metamodelId, ecoreXml);

      return {
        success: result,
        message: result ? `Imported ${ecoreEntry.entryName} successfully` : 'Import failed',
        ecoreFile: ecoreEntry.entryName,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Eclipse ZIP import failed: ${err.message}`);
      throw new BadRequestException(`Failed to process ZIP: ${err.message}`);
    }
  }

  /**
   * POST /projects/:projectId/xmi/:metamodelId/instance/import
   * Importa una instancia .xmi (M1) conforme al metamodelo.
   * Acepta { xml: string } en el body.
   */
  @Post(':metamodelId/instance/import')
  async importInstance(
    @Param('projectId') projectId: string,
    @Param('metamodelId') metamodelId: string,
    @Body() body: { xml: string },
  ): Promise<{ document: XmiInstanceDocument | null; error?: string }> {
    const { xml } = body;
    if (!xml) {
      throw new BadRequestException('XML content is required. Send { xml: "..." }.');
    }
    return this.xmiService.importInstance(projectId, metamodelId, xml);
  }

  /**
   * POST /projects/:projectId/xmi/:metamodelId/instance/export
   * Exporta una instancia .xmi (M1) conforme al metamodelo.
   * Acepta { document: XmiInstanceDocument } en el body.
   * Devuelve el XMI XML string.
   */
  @Post(':metamodelId/instance/export')
  async exportInstance(
    @Param('projectId') projectId: string,
    @Param('metamodelId') metamodelId: string,
    @Body() body: { document: XmiInstanceDocument },
  ): Promise<{ xml: string }> {
    const { document } = body;
    if (!document) {
      throw new BadRequestException('Document is required. Send { document: ... }.');
    }
    const xml = await this.xmiService.exportInstance(projectId, metamodelId, document);
    if (xml === null) {
      throw new NotFoundException('Metamodel not found');
    }
    return { xml };
  }
}
