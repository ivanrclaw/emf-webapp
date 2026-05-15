/**
 * @emf-webapp/frontend — spec-diagram types
 *
 * Tipos compartidos entre SpecNode, SpecEdge, SpecStylePanel y SpecEditor.
 */

export interface ShapeStyle {
  shape: 'rectangle' | 'ellipse' | 'diamond';
  color: string;
  borderColor: string;
  borderSize: number;
  labelExpression: string;
  labelPosition: 'inside' | 'top' | 'bottom';
}

export interface EdgeStyle {
  lineStyle: 'solid' | 'dash' | 'dot' | 'dash-dot';
  sourceDecoration: 'none' | 'arrow' | 'diamond' | 'filled-diamond';
  targetDecoration: 'none' | 'arrow' | 'diamond' | 'filled-diamond';
  color: string;
  labelExpression: string;
}

export interface Mapping {
  domainClass: string;
  semanticCandidatesExpression: string;
  style: ShapeStyle;
  edgeMappings: {
    domainClass: string;
    sourceMapping: string;
    targetMapping: string;
    style: EdgeStyle;
  }[];
}

export interface Layer {
  name: string;
  default: boolean;
  mappings: Mapping[];
}

export interface SpecData {
  name: string;
  domain: string;
  layers: Layer[];
}
