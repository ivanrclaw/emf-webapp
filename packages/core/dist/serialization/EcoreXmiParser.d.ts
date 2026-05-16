/**
 * @emf-webapp/core — EcoreXmiParser
 *
 * Parsea archivos .ecore (XMI 2.0) generados por Eclipse EMF
 * y los convierte a SerializableEPackage para usar en el editor web.
 *
 * Formato soportado:
 *   <ecore:EPackage xmi:version="2.0" ...>
 *     <eClassifiers xsi:type="ecore:EClass" name="ClassName" .../>
 *     <eClassifiers xsi:type="ecore:EEnum" name="EnumName" .../>
 *     <eClassifiers xsi:type="ecore:EDataType" name="TypeName" .../>
 *   </ecore:EPackage>
 *
 * Referencia: https://eclipse.dev/emf/docs/XMI_Format
 */
import type { SerializableEPackage } from './SerializableToEcoreConverter.js';
/**
 * Parsea un string XML .ecore a SerializableEPackage.
 * @throws Error si el XML no es válido o no contiene un EPackage
 */
export declare function parseEcoreXmi(xml: string): SerializableEPackage;
//# sourceMappingURL=EcoreXmiParser.d.ts.map