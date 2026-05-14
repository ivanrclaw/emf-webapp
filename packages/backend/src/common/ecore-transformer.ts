/**
 * @emf-webapp/backend — EcoreTransformer
 *
 * Pipe/transformer que convierte JSON almacenado a EPackageImpl y viceversa
 * usando los serializadores del core (@emf-webapp/core).
 *
 * También provee exportación a JSON pretty-printed o XMI 2.0.
 */
import { Injectable } from '@nestjs/common';
import {
  deserializeEObject,
  serializeEObject,
  serializeToXMI,
  EPackageImpl,
} from '@emf-webapp/core';

@Injectable()
export class EcoreTransformer {
  /**
   * Convierte un objeto JSON (almacenado en la base de datos) de vuelta
   * a una instancia EPackageImpl usando el deserializador del core.
   */
  deserializeToEPackage(content: Record<string, any>): EPackageImpl {
    const eobj = deserializeEObject(content);
    // Verificar que el resultado sea un EPackageImpl
    if (!(eobj instanceof EPackageImpl)) {
      throw new Error('El contenido JSON no representa un EPackage válido');
    }
    return eobj;
  }

  /**
   * Serializa un EPackageImpl a un objeto JSON plano listo para
   * almacenar en la columna `content` de la base de datos.
   */
  serializeToJSON(ePackage: EPackageImpl): Record<string, any> {
    return JSON.parse(serializeEObject(ePackage));
  }

  /**
   * Exporta el contenido de un metamodelo al formato solicitado.
   *
   * @param content  JSON almacenado en la BD
   * @param nsURI    Namespace URI del paquete
   * @param nsPrefix Namespace prefix del paquete
   * @param format   'json' (pretty-printed) | 'xmi'
   * @returns        String formateado (JSON o XMI)
   */
  export(
    content: Record<string, any>,
    nsURI: string,
    nsPrefix: string,
    format: 'json' | 'xmi',
  ): string {
    if (format === 'json') {
      return JSON.stringify(content, null, 2);
    }

    if (format === 'xmi') {
      const ePackage = this.deserializeToEPackage(content);
      return serializeToXMI(ePackage, { nsURI, nsPrefix });
    }

    throw new Error(`Formato no soportado: ${String(format)}`);
  }
}
