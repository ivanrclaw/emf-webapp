import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Download, BookOpen, Database, FileText, Globe } from 'lucide-react';
import { useIDEStore, type IDEFile } from './useIDEStore';

// ── Template data ────────────────────────────────────────────────────

export interface TemplateItem {
  id: string;
  name: string;
  category: 'Structural' | 'Persistence' | 'Documentation' | 'API';
  description: string;
  filename: string;
  content: string;
}

const TEMPLATES: TemplateItem[] = [
  {
    id: 'java-classes',
    name: 'Java Classes',
    category: 'Structural',
    description: 'Generate Java classes with getters/setters from EClasses',
    filename: 'generateJava.mtl',
    content: `[comment encoding = UTF-8 /]
[module generateJava('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateClass(c : EClass)]
[file (c.name.concat('.java'), false, 'UTF-8')]
package [c.ePackage.name/];

public [if (c.abstract)]abstract [/if]class [c.name/][if (c.eSuperTypes->notEmpty())] extends [c.eSuperTypes->first().name/][/if] {
[for (attr : EAttribute | c.eAllAttributes)]
    private [attr.eType.name/] [attr.name/];
[/for]

[for (attr : EAttribute | c.eAllAttributes)]
    public [attr.eType.name/] get[attr.name.toUpperFirst()/]() {
        return this.[attr.name/];
    }

    public void set[attr.name.toUpperFirst()/]([attr.eType.name/] [attr.name/]) {
        this.[attr.name/] = [attr.name/];
    }
[/for]
}
[/file]
[/template]
`,
  },
  {
    id: 'typescript-interfaces',
    name: 'TypeScript Interfaces',
    category: 'Structural',
    description: 'Generate TypeScript interfaces from EClasses with references',
    filename: 'generateTypeScript.mtl',
    content: `[comment encoding = UTF-8 /]
[module generateTypeScript('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateInterface(c : EClass)]
[file (c.name.concat('.ts'), false, 'UTF-8')]
export interface [c.name/][if (c.eSuperTypes->notEmpty())] extends [c.eSuperTypes->first().name/][/if] {
[for (attr : EAttribute | c.eAllAttributes)]
  [attr.name/]: [attr.eType.name/];
[/for]
[for (ref : EReference | c.eAllReferences)]
  [ref.name/]: [ref.eType.name/][if (ref.upperBound <> 1)][][/if];
[/for]
}
[/file]
[/template]
`,
  },
  {
    id: 'python-dataclasses',
    name: 'Python Dataclasses',
    category: 'Structural',
    description: 'Generate Python dataclasses with type annotations',
    filename: 'generatePython.mtl',
    content: `[comment encoding = UTF-8 /]
[module generatePython('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateDataclass(c : EClass)]
[file (c.name.toLower().concat('.py'), false, 'UTF-8')]
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class [c.name/][if (c.eSuperTypes->notEmpty())]([c.eSuperTypes->first().name/])[/if]:
    """[c.name/] data class."""
[for (attr : EAttribute | c.eAllAttributes)]
    [attr.name/]: [if (attr.eType.name = 'EString')]str[elseif (attr.eType.name = 'EInt')]int[elseif (attr.eType.name = 'EBoolean')]bool[elseif (attr.eType.name = 'EFloat')]float[else]str[/if][if (attr.lowerBound = 0)] = None[/if]
[/for]
[for (ref : EReference | c.eAllReferences)]
    [ref.name/]: [if (ref.upperBound <> 1)]List['[ref.eType.name/]'][else]Optional['[ref.eType.name/]'][/if] = None
[/for]
[/file]
[/template]
`,
  },
  {
    id: 'sql-ddl',
    name: 'SQL DDL Schema',
    category: 'Persistence',
    description: 'Generate SQL CREATE TABLE statements from EPackage',
    filename: 'generateSQL.mtl',
    content: `[comment encoding = UTF-8 /]
[module generateSQL('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateDDL(p : EPackage)]
[file ('schema.sql', false, 'UTF-8')]
-- Generated DDL for [p.name/]
[for (c : EClass | p.eClassifiers->filter(EClass)->select(c | not c.abstract))]

CREATE TABLE [c.name.toLower()/] (
    id SERIAL PRIMARY KEY[for (attr : EAttribute | c.eAllAttributes)],
    [attr.name/] [if (attr.eType.name = 'EString')]VARCHAR(255)[elseif (attr.eType.name = 'EInt')]INTEGER[elseif (attr.eType.name = 'EBoolean')]BOOLEAN[else]TEXT[/if][if (not attr.lowerBound.oclIsUndefined() and attr.lowerBound > 0)] NOT NULL[/if][/for][for (ref : EReference | c.eAllReferences->select(r | not r.containment))],
    [ref.name/]_id INTEGER REFERENCES [ref.eType.name.toLower()/](id)[/for]
);
[/for]
[/file]
[/template]
`,
  },
  {
    id: 'jpa-entities',
    name: 'JPA Entities',
    category: 'Persistence',
    description: 'Generate JPA entity classes with annotations',
    filename: 'generateJPA.mtl',
    content: `[comment encoding = UTF-8 /]
[module generateJPA('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateEntity(c : EClass)]
[file (c.name.concat('.java'), false, 'UTF-8')]
package [c.ePackage.name/].entity;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "[c.name.toLower()/]")
public class [c.name/] {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

[for (attr : EAttribute | c.eAllAttributes)]
    @Column(name = "[attr.name/]"[if (not attr.lowerBound.oclIsUndefined() and attr.lowerBound > 0)], nullable = false[/if])
    private [attr.eType.name/] [attr.name/];

[/for]
[for (ref : EReference | c.eAllReferences)]
[if (ref.upperBound = 1)]
    @ManyToOne
    @JoinColumn(name = "[ref.name/]_id")
    private [ref.eType.name/] [ref.name/];
[else]
    @OneToMany(mappedBy = "[c.name.toLowerFirst()/]", cascade = CascadeType.ALL)
    private List<[ref.eType.name/]> [ref.name/];
[/if]

[/for]
    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
[for (attr : EAttribute | c.eAllAttributes)]

    public [attr.eType.name/] get[attr.name.toUpperFirst()/]() { return [attr.name/]; }
    public void set[attr.name.toUpperFirst()/]([attr.eType.name/] [attr.name/]) { this.[attr.name/] = [attr.name/]; }
[/for]
}
[/file]
[/template]
`,
  },
  {
    id: 'rest-controller',
    name: 'REST Controllers',
    category: 'API',
    description: 'Generate Spring Boot REST controllers with CRUD endpoints',
    filename: 'generateREST.mtl',
    content: `[comment encoding = UTF-8 /]
[module generateREST('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateController(c : EClass)]
[file (c.name.concat('Controller.java'), false, 'UTF-8')]
package [c.ePackage.name/].controller;

import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/[c.name.toLower()/]s")
public class [c.name/]Controller {

    @GetMapping
    public List<[c.name/]> getAll() {
        // TODO: implement
        return List.of();
    }

    @GetMapping("/{id}")
    public [c.name/] getById(@PathVariable Long id) {
        // TODO: implement
        return null;
    }

    @PostMapping
    public [c.name/] create(@RequestBody [c.name/] entity) {
        // TODO: implement
        return entity;
    }

    @PutMapping("/{id}")
    public [c.name/] update(@PathVariable Long id, @RequestBody [c.name/] entity) {
        // TODO: implement
        return entity;
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        // TODO: implement
    }
}
[/file]
[/template]
`,
  },
  {
    id: 'openapi-spec',
    name: 'OpenAPI Specification',
    category: 'API',
    description: 'Generate OpenAPI 3.0 YAML specification from EClasses',
    filename: 'generateOpenAPI.mtl',
    content: `[comment encoding = UTF-8 /]
[module generateOpenAPI('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateSpec(p : EPackage)]
[file ('openapi.yaml', false, 'UTF-8')]
openapi: 3.0.3
info:
  title: [p.name.toUpperFirst()/] API
  version: 1.0.0
  description: Auto-generated API for [p.name/]

paths:
[for (c : EClass | p.eClassifiers->filter(EClass)->select(c | not c.abstract))]
  /api/[c.name.toLower()/]s:
    get:
      summary: List all [c.name/]
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/[c.name/]'
    post:
      summary: Create [c.name/]
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/[c.name/]'
      responses:
        '201':
          description: Created
[/for]

components:
  schemas:
[for (c : EClass | p.eClassifiers->filter(EClass))]
    [c.name/]:
      type: object
      properties:
        id:
          type: integer
[for (attr : EAttribute | c.eAllAttributes)]
        [attr.name/]:
          type: [if (attr.eType.name = 'EString')]string[elseif (attr.eType.name = 'EInt')]integer[elseif (attr.eType.name = 'EBoolean')]boolean[elseif (attr.eType.name = 'EFloat')]number[else]string[/if]
[/for]
[/for]
[/file]
[/template]
`,
  },
  {
    id: 'markdown-docs',
    name: 'Markdown Documentation',
    category: 'Documentation',
    description: 'Generate Markdown documentation for model classes',
    filename: 'generateDocs.mtl',
    content: `[comment encoding = UTF-8 /]
[module generateDocs('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateDocumentation(p : EPackage)]
[file ('documentation.md', false, 'UTF-8')]
# [p.name.toUpperFirst()/] Model Documentation

> Auto-generated documentation from the metamodel.

## Classes

[for (c : EClass | p.eClassifiers->filter(EClass))]
### [c.name/]

[if (c.abstract)]_Abstract class_[/if]
[if (c.eSuperTypes->notEmpty())]
**Extends:** [c.eSuperTypes->first().name/]
[/if]

| Attribute | Type | Required |
|-----------|------|----------|
[for (attr : EAttribute | c.eAllAttributes)]
| [attr.name/] | [attr.eType.name/] | [if (attr.lowerBound > 0)]Yes[else]No[/if] |
[/for]

[if (c.eAllReferences->notEmpty())]
**References:**
[for (ref : EReference | c.eAllReferences)]
- [ref.name/] → [ref.eType.name/] [if (ref.upperBound <> 1)](many)[else](one)[/if]
[/for]
[/if]

[/for]
[/file]
[/template]
`,
  },
  {
    id: 'plantuml-diagram',
    name: 'PlantUML Class Diagram',
    category: 'Documentation',
    description: 'Generate PlantUML class diagrams from EPackage',
    filename: 'generatePlantUML.mtl',
    content: `[comment encoding = UTF-8 /]
[module generatePlantUML('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateDiagram(p : EPackage)]
[file ('diagram.puml', false, 'UTF-8')]
@startuml [p.name/]

skinparam classAttributeIconSize 0
skinparam classFontStyle bold

[for (c : EClass | p.eClassifiers->filter(EClass))]
[if (c.abstract)]abstract [/if]class [c.name/] {
[for (attr : EAttribute | c.eAllAttributes)]
  +[attr.name/] : [attr.eType.name/]
[/for]
}

[/for]
[for (c : EClass | p.eClassifiers->filter(EClass))]
[for (sup : EClass | c.eSuperTypes)]
[sup.name/] <|-- [c.name/]
[/for]
[for (ref : EReference | c.eAllReferences)]
[c.name/] [if (ref.containment)]*[else]o[/if]-- [if (ref.upperBound <> 1)]"*"[else]"1"[/if] [ref.eType.name/] : [ref.name/]
[/for]
[/for]

@enduml
[/file]
[/template]
`,
  },
  {
    id: 'graphql-schema',
    name: 'GraphQL Schema',
    category: 'API',
    description: 'Generate GraphQL type definitions and queries',
    filename: 'generateGraphQL.mtl',
    content: `[comment encoding = UTF-8 /]
[module generateGraphQL('http://www.eclipse.org/emf/2002/Ecore')]

[template public generateSchema(p : EPackage)]
[file ('schema.graphql', false, 'UTF-8')]
# Generated GraphQL schema for [p.name/]

[for (c : EClass | p.eClassifiers->filter(EClass)->select(c | not c.abstract))]
type [c.name/] {
  id: ID!
[for (attr : EAttribute | c.eAllAttributes)]
  [attr.name/]: [if (attr.eType.name = 'EString')]String[elseif (attr.eType.name = 'EInt')]Int[elseif (attr.eType.name = 'EBoolean')]Boolean[elseif (attr.eType.name = 'EFloat')]Float[else]String[/if][if (attr.lowerBound > 0)]![/if]
[/for]
[for (ref : EReference | c.eAllReferences)]
  [ref.name/]: [if (ref.upperBound <> 1)]['['/][ref.eType.name/][']'/][else][ref.eType.name/][/if]
[/for]
}

[/for]
type Query {
[for (c : EClass | p.eClassifiers->filter(EClass)->select(c | not c.abstract))]
  all[c.name/]s: ['['/][c.name/][']'/]!
  [c.name.toLowerFirst()/](id: ID!): [c.name/]
[/for]
}

type Mutation {
[for (c : EClass | p.eClassifiers->filter(EClass)->select(c | not c.abstract))]
  create[c.name/](input: [c.name/]Input!): [c.name/]!
  update[c.name/](id: ID!, input: [c.name/]Input!): [c.name/]!
  delete[c.name/](id: ID!): Boolean!
[/for]
}
[/file]
[/template]
`,
  },
];

const CATEGORY_ICONS: Record<TemplateItem['category'], typeof BookOpen> = {
  Structural: BookOpen,
  Persistence: Database,
  Documentation: FileText,
  API: Globe,
};

const CATEGORY_COLORS: Record<TemplateItem['category'], string> = {
  Structural: '#61afef',
  Persistence: '#e5c07b',
  Documentation: '#98c379',
  API: '#c678dd',
};

// ── Component ────────────────────────────────────────────────────────

interface TemplateLibraryProps {
  open: boolean;
  onClose: () => void;
}

export function TemplateLibrary({ open, onClose }: TemplateLibraryProps) {
  const { addFile } = useIDEStore();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateItem['category'] | 'All'>('All');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories: Array<TemplateItem['category'] | 'All'> = ['All', 'Structural', 'Persistence', 'Documentation', 'API'];

  const filtered = useMemo(() => {
    let items = TEMPLATES;
    if (selectedCategory !== 'All') {
      items = items.filter((t) => t.category === selectedCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      );
    }
    return items;
  }, [query, selectedCategory]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedCategory('All');
      setPreviewId(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleImport = (template: TemplateItem) => {
    const newFile: IDEFile = {
      id: crypto.randomUUID(),
      filename: template.filename,
      content: template.content,
      language: 'mtl',
      isDirty: true,
      hasErrors: false,
      isNew: true,
    };
    addFile(newFile);
    onClose();
  };

  if (!open) return null;

  const previewTemplate = previewId ? TEMPLATES.find((t) => t.id === previewId) : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Template Library"
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: 720,
          maxHeight: '80vh',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Template Library
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search + Filters */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates..."
              aria-label="Search templates"
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 13,
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedCategory === cat ? 'var(--accent)' : 'var(--surface)',
                  color: selectedCategory === cat ? '#fff' : 'var(--text-muted)',
                  fontWeight: selectedCategory === cat ? 600 : 400,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
          {previewTemplate ? (
            // Preview mode
            <div>
              <button
                onClick={() => setPreviewId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  fontSize: 12,
                  marginBottom: 10,
                  padding: 0,
                }}
              >
                ← Back to list
              </button>
              <h3 style={{ fontSize: 14, color: 'var(--text)', margin: '0 0 4px' }}>
                {previewTemplate.name}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                {previewTemplate.description}
              </p>
              <pre
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 11,
                  color: 'var(--text)',
                  overflow: 'auto',
                  maxHeight: 300,
                  whiteSpace: 'pre-wrap',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {previewTemplate.content}
              </pre>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handleImport(previewTemplate)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Download size={12} />
                  Import Template
                </button>
              </div>
            </div>
          ) : (
            // List mode
            <div style={{ display: 'grid', gap: 8 }}>
              {filtered.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 32,
                    color: 'var(--text-muted)',
                    fontSize: 12,
                  }}
                >
                  No templates match your search
                </div>
              )}
              {filtered.map((template) => {
                const Icon = CATEGORY_ICONS[template.category];
                return (
                  <div
                    key={template.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onClick={() => setPreviewId(template.id)}
                  >
                    <Icon size={18} style={{ color: CATEGORY_COLORS[template.category], flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {template.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 8,
                            background: CATEGORY_COLORS[template.category] + '22',
                            color: CATEGORY_COLORS[template.category],
                          }}
                        >
                          {template.category}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {template.description}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImport(template);
                      }}
                      className="btn btn-ghost btn-sm"
                      title="Import template"
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Download size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
