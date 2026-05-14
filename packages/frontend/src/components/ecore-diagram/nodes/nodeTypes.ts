/**
 * @emf-webapp/frontend — Node Type Registry
 *
 * Registra los tipos de nodos personalizados para React Flow.
 * Importado por EcoreEditor.tsx como nodeTypes.
 */
import EClassNode from './EClassNode';
import EEnumNode from './EEnumNode';
import EDataTypeNode from './EDataTypeNode';

export const nodeTypes = {
  eClassNode: EClassNode,
  eEnumNode: EEnumNode,
  eDataTypeNode: EDataTypeNode,
};

export default nodeTypes;
