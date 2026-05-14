/**
 * @emf-webapp/core — JSONSerializer
 *
 * Serialización/deserialización de EObject/EPackage a JSON compatible con emfjson.
 *
 * Formato emfjson:
 * - eClass: URI fragment (e.g. "http://www.eclipse.org/emf/2002/Ecore#//EClass")
 * - EAttribute: valores JSON primitivos (string, number, boolean, null)
 * - EReference containment=true: objetos anidados (recursivo)
 * - EReference containment=false: arrays de strings (URI fragment paths)
 * - EList: serializado como array JSON
 */
import { EListImpl } from '../util/EList.js';
// ============================================================
// Constantes
// ============================================================
const ECORE_NS_URI = 'http://www.eclipse.org/emf/2002/Ecore';
// ============================================================
// Helpers de fragment path
// ============================================================
/**
 * Obtiene el URI fragment para una EClass dentro de un EPackage.
 * Formato: "nsURI#//ClassName"
 */
function getEClassFragment(eClass) {
    const pkg = eClass.ePackage;
    const nsURI = pkg ? pkg.nsURI : ECORE_NS_URI;
    return `${nsURI}#//${eClass.name}`;
}
/**
 * Obtiene el URI fragment para un feature dentro de una EClass.
 * Formato: "nsURI#//ClassName/featureName"
 */
function getFeatureFragment(eClass, featureName) {
    const pkg = eClass.ePackage;
    const nsURI = pkg ? pkg.nsURI : ECORE_NS_URI;
    return `${nsURI}#//${eClass.name}/${featureName}`;
}
/**
 * Obtiene el fragment path para una EObject referenciada (no containment).
 * Formato: "nsURI#//ClassName/featureName/.../objectName"
 * Para objetos M1 sin recurso, usamos un path basado en contenedores.
 */
function getObjectFragmentPath(obj) {
    const eClass = obj.eClass();
    const pkg = eClass.ePackage;
    const nsURI = pkg ? pkg.nsURI : ECORE_NS_URI;
    // Construir el path dentro del contenedor
    const segments = [];
    // Buscar el feature que contiene a este objeto en su contenedor
    let current = obj;
    while (current) {
        const container = current.eContainer();
        if (!container)
            break;
        // Encontrar qué feature del contenedor apunta a 'current'
        const contClass = container.eClass();
        if (!contClass)
            break;
        for (const feature of contClass.eAllStructuralFeatures) {
            if (!('containment' in feature))
                continue;
            const ref = feature;
            if (!ref.containment)
                continue;
            const value = container.eGet(ref);
            if (ref.many) {
                const list = Array.from(value);
                const idx = list.indexOf(current);
                if (idx >= 0) {
                    // Para listas, usamos el nombre del feature posicional
                    // En emfjson, los objetos en listas no suelen tener key individual
                    // Usamos el nombre del elemento si tiene name
                    const name = current.name;
                    if (name && typeof name === 'string') {
                        segments.unshift(name);
                    }
                    else {
                        segments.unshift(`.${idx}`);
                    }
                    break;
                }
            }
            else if (value === current) {
                // Single containment — usar nombre si disponible
                const name = current.name;
                if (name && typeof name === 'string') {
                    segments.unshift(name);
                }
                else {
                    segments.unshift(feature.name);
                }
                break;
            }
        }
        current = container;
    }
    if (segments.length === 0) {
        const name = obj.name;
        if (name && typeof name === 'string') {
            return `${nsURI}#//${eClass.name}/${name}`;
        }
        return `${nsURI}#//${eClass.name}`;
    }
    return `${nsURI}#//${eClass.name}/${segments.join('/')}`;
}
/**
 * Determina si un valor de atributo puede serializarse de forma directa como valor JSON.
 */
function isPrimitiveValue(value) {
    return (value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean');
}
/**
 * Convierte un valor de atributo EMF a JSON.
 * Para EDataType, convertimos a string (createFromString inverso simplificado).
 */
function serializeAttributeValue(value, eDataType) {
    if (value === null || value === undefined)
        return null;
    if (isPrimitiveValue(value))
        return value;
    // Para valores Date, convertir a ISO string
    if (value instanceof Date)
        return value.toISOString();
    // Para arrays (EByteArray), serializar como string
    if (Array.isArray(value)) {
        // Verificar si es byte array
        if (value.length > 0 && typeof value[0] === 'number') {
            return value.map(b => String.fromCharCode(b)).join('');
        }
        return value.map(v => serializeAttributeValue(v, null));
    }
    // Fallback: toString
    if (typeof value.toString === 'function') {
        return value.toString();
    }
    return String(value);
}
/**
 * Intenta convertir un valor JSON a un valor tipado para un EDataType.
 */
function deserializeAttributeValue(jsonValue, eDataType) {
    if (jsonValue === null || jsonValue === undefined)
        return null;
    if (!eDataType)
        return jsonValue;
    const typeName = eDataType.name;
    switch (typeName) {
        case 'EString':
            return String(jsonValue);
        case 'EBoolean':
            if (typeof jsonValue === 'boolean')
                return jsonValue;
            if (typeof jsonValue === 'string')
                return jsonValue.toLowerCase() === 'true';
            return Boolean(jsonValue);
        case 'EInt':
            return typeof jsonValue === 'number' ? Math.floor(jsonValue) : parseInt(String(jsonValue), 10);
        case 'ELong':
            return typeof jsonValue === 'number' ? jsonValue : Number(jsonValue);
        case 'EFloat':
        case 'EDouble':
            return typeof jsonValue === 'number' ? jsonValue : parseFloat(String(jsonValue));
        case 'EByte':
            return typeof jsonValue === 'number' ? jsonValue : parseInt(String(jsonValue), 10);
        case 'EShort':
            return typeof jsonValue === 'number' ? jsonValue : parseInt(String(jsonValue), 10);
        case 'EChar':
            return String(jsonValue).charAt(0);
        case 'EBigDecimal':
        case 'EBigInteger':
            return Number(jsonValue);
        case 'EDate':
            return new Date(String(jsonValue));
        case 'EByteArray':
            if (typeof jsonValue === 'string')
                return jsonValue.split('').map(c => c.charCodeAt(0));
            return jsonValue;
        default:
            // Para tipos personalizados, devolver el valor como string
            return jsonValue;
    }
}
// ============================================================
// Serialización
// ============================================================
/**
 * Serializa un EObject a JSON compatible con emfjson.
 *
 * @param obj - El EObject a serializar
 * @param options - Opciones de serialización
 * @param options.pretty - Si se debe formatear el JSON con indentación (default: false)
 * @param options.rootPackage - EPackage raíz para resolver referencias (opcional)
 * @returns String JSON
 */
export function serializeEObject(obj, options) {
    const data = serializeEObjectInternal(obj, new Set(), options?.rootPackage ?? null);
    return options?.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}
/**
 * Serializa un EObject a un objeto JSON en memoria.
 */
function serializeEObjectInternal(obj, visited, rootPackage) {
    const eClass = obj.eClass();
    if (!eClass) {
        throw new Error('Object has no eClass');
    }
    const json = {
        eClass: getEClassFragment(eClass),
    };
    visited.add(obj);
    // Serializar features en orden
    for (const feature of eClass.eAllStructuralFeatures) {
        // Saltar features transient/derived/volatile
        if (feature.transient || feature.derived || feature.volatile)
            continue;
        const value = obj.eGet(feature);
        if ('containment' in feature) {
            const ref = feature;
            if (ref.containment) {
                // Containment: serializar como objetos anidados o arrays de objetos
                if (ref.many) {
                    const list = Array.from(value);
                    const items = list
                        .filter(item => item !== null && item !== undefined)
                        .map(item => {
                        if (visited.has(item)) {
                            // Ya visitado: serializar como referencia
                            return getObjectFragmentPath(item);
                        }
                        return serializeEObjectInternal(item, visited, rootPackage);
                    });
                    if (items.length > 0) {
                        json[feature.name] = items;
                    }
                }
                else {
                    if (value !== null && value !== undefined) {
                        if (visited.has(value)) {
                            json[feature.name] = getObjectFragmentPath(value);
                        }
                        else {
                            json[feature.name] = serializeEObjectInternal(value, visited, rootPackage);
                        }
                    }
                }
            }
            else {
                // Non-containment reference: serializar como fragment path(s)
                if (ref.many) {
                    const list = Array.from(value);
                    const paths = list
                        .filter(item => item !== null && item !== undefined)
                        .map(item => getObjectFragmentPath(item));
                    if (paths.length > 0) {
                        json[feature.name] = paths;
                    }
                }
                else {
                    if (value !== null && value !== undefined) {
                        json[feature.name] = getObjectFragmentPath(value);
                    }
                }
            }
        }
        else if ('iD' in feature) {
            // EAttribute
            const attr = feature;
            const serialized = serializeAttributeValue(value, attr.eAttributeType);
            if (attr.many) {
                const list = Array.from(value);
                if (list.length > 0) {
                    json[feature.name] = list.map(v => serializeAttributeValue(v, attr.eAttributeType));
                }
            }
            else {
                // Siempre incluir atributos si tienen valor (no undefined)
                if (value !== undefined && value !== null) {
                    json[feature.name] = serialized;
                }
            }
        }
    }
    return json;
}
// ============================================================
// Deserialización
// ============================================================
/**
 * Deserializa un EObject desde JSON.
 *
 * @param json - String JSON o objeto JavaScript
 * @param registry - PackageRegistry para resolver paquetes por nsURI
 * @returns El EObject deserializado
 */
export function deserializeEObject(json, registry) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (!data || typeof data !== 'object') {
        throw new Error('JSON must be an object');
    }
    const rootRecord = data;
    if (!rootRecord.eClass) {
        throw new Error('JSON object must have an "eClass" field');
    }
    // Resolver el eClass
    const eClass = resolveEClass(rootRecord.eClass, registry);
    if (!eClass) {
        throw new Error(`Cannot resolve eClass: ${rootRecord.eClass}`);
    }
    // Deserializar con tracking de todos los objetos creados
    const allObjects = new Map();
    const pendingReferences = [];
    const root = deserializeEObjectInternal(data, registry, eClass, allObjects, pendingReferences, '');
    // Resolver referencias pendientes (non-containment)
    for (const pending of pendingReferences) {
        if (pending.isMany) {
            const paths = pending.path;
            const resolvedList = paths
                .map(path => resolveFragmentPath(path, allObjects))
                .filter(ref => ref !== null);
            if (resolvedList.length > 0) {
                pending.owner.eSet(pending.feature, resolvedList);
            }
        }
        else {
            const resolved = resolveFragmentPath(pending.path, allObjects);
            if (resolved) {
                pending.owner.eSet(pending.feature, resolved);
            }
        }
    }
    return root;
}
/**
 * Deserializa internamente un objeto JSON a EObject.
 */
function deserializeEObjectInternal(data, registry, eClass, allObjects, pendingReferences, currentPath) {
    const record = data;
    const eClassUri = record.eClass;
    // Resolver el eClass (podría ser diferente del root para objetos anidados)
    let resolvedClass = eClass;
    if (eClassUri) {
        const resolved = resolveEClass(eClassUri, registry);
        if (resolved) {
            resolvedClass = resolved;
        }
    }
    // Crear instancia usando la fábrica del paquete
    const factory = resolvedClass.ePackage?.eFactoryInstance;
    const obj = factory ? factory.create(resolvedClass) : createMinimalEObject(resolvedClass);
    // Registrar este objeto
    const name = record.name;
    let objPath = currentPath;
    if (name) {
        objPath = objPath ? `${objPath}/${name}` : name;
    }
    allObjects.set(objPath, obj);
    // Procesar cada feature
    for (const feature of resolvedClass.eAllStructuralFeatures) {
        const featureName = feature.name;
        if (!(featureName in record))
            continue;
        const jsonValue = record[featureName];
        if ('containment' in feature) {
            const ref = feature;
            if (ref.containment) {
                // Containment: deserializar objetos anidados
                if (ref.many) {
                    if (Array.isArray(jsonValue)) {
                        const containedObjects = [];
                        jsonValue.forEach((item, idx) => {
                            if (typeof item === 'object' && item !== null && item.eClass) {
                                const childPath = objPath ? `${objPath}/${idx}` : `${idx}`;
                                const child = deserializeEObjectInternal(item, registry, ref.eReferenceType, allObjects, pendingReferences, childPath);
                                containedObjects.push(child);
                            }
                            else if (typeof item === 'string') {
                                // Referencia a otro objeto (ya visitado)
                                pendingReferences.push({
                                    owner: obj,
                                    feature: ref,
                                    path: [item],
                                    isMany: true,
                                });
                            }
                        });
                        if (containedObjects.length > 0) {
                            obj.eSet(ref, containedObjects);
                        }
                    }
                }
                else {
                    if (typeof jsonValue === 'object' && jsonValue !== null && jsonValue.eClass) {
                        const childPath = objPath ? `${objPath}/${featureName}` : featureName;
                        const child = deserializeEObjectInternal(jsonValue, registry, ref.eReferenceType, allObjects, pendingReferences, childPath);
                        obj.eSet(ref, child);
                    }
                    else if (typeof jsonValue === 'string') {
                        pendingReferences.push({
                            owner: obj,
                            feature: ref,
                            path: jsonValue,
                            isMany: false,
                        });
                    }
                }
            }
            else {
                // Non-containment: guardar para resolver después
                if (ref.many && Array.isArray(jsonValue)) {
                    pendingReferences.push({
                        owner: obj,
                        feature: ref,
                        path: jsonValue,
                        isMany: true,
                    });
                }
                else if (typeof jsonValue === 'string') {
                    pendingReferences.push({
                        owner: obj,
                        feature: ref,
                        path: jsonValue,
                        isMany: false,
                    });
                }
            }
        }
        else if ('iD' in feature) {
            // EAttribute
            const attr = feature;
            const eDataType = attr.eAttributeType;
            if (attr.many && Array.isArray(jsonValue)) {
                const deserializedList = jsonValue.map(v => deserializeAttributeValue(v, eDataType));
                obj.eSet(attr, deserializedList);
            }
            else if (!attr.many) {
                const deserialized = deserializeAttributeValue(jsonValue, eDataType);
                obj.eSet(attr, deserialized);
            }
        }
    }
    return obj;
}
/**
 * Resuelve un eClass URI fragment a una EClass usando el PackageRegistry.
 */
function resolveEClass(eClassUri, registry) {
    // Formato: "nsURI#//ClassName"
    const hashIndex = eClassUri.indexOf('#');
    if (hashIndex < 0)
        return null;
    const nsURI = eClassUri.substring(0, hashIndex);
    const fragment = eClassUri.substring(hashIndex + 1);
    // El fragment tiene formato "//ClassName" (emfjson) o "/ClassName" (simplificado)
    const parts = fragment.split('/').filter(p => p.length > 0);
    const className = parts[0];
    if (!className)
        return null;
    // Buscar el paquete por nsURI
    let pkg = null;
    if (registry) {
        pkg = registry.getEPackage(nsURI);
    }
    // Si no se encuentra en registry, intentar con nsURI = Ecore
    if (!pkg && nsURI === ECORE_NS_URI) {
        // Para el metamodelo Ecore, intentar buscarlo en registry
        if (registry) {
            pkg = registry.getEPackage(ECORE_NS_URI);
        }
    }
    if (!pkg)
        return null;
    // Buscar el clasificador por nombre
    const classifier = pkg.getEClassifier(className);
    if (!classifier)
        return null;
    // Verificar que sea una EClass
    if (!('eSuperTypes' in classifier))
        return null;
    return classifier;
}
/**
 * Resuelve un fragment path a un EObject ya deserializado.
 */
function resolveFragmentPath(path, allObjects) {
    // Formato: "nsURI#//ClassName/segments..."
    const hashIndex = path.indexOf('#');
    if (hashIndex < 0)
        return null;
    const fragment = path.substring(hashIndex + 1);
    // El fragment tiene formato "//ClassName/feature1/..." o "/ClassName/..."
    const parts = fragment.split('/').filter(p => p.length > 0);
    // parts[0] = className, parts[1..N] = path segments
    if (parts.length < 1)
        return null;
    const className = parts[0];
    // Construir la key de búsqueda
    // Intentar con el path completo después del className
    const remainingParts = parts.slice(1);
    const searchKey = remainingParts.join('/');
    // Búsqueda directa en allObjects
    if (searchKey && allObjects.has(searchKey)) {
        return allObjects.get(searchKey);
    }
    // Búsqueda por path completo incluyendo className
    for (const [key, obj] of allObjects) {
        const objEClass = obj.eClass();
        if (objEClass.name === className) {
            const objName = obj.name;
            if (objName === searchKey || key === searchKey) {
                return obj;
            }
            // Comparación flexible: el path puede terminar con el nombre
            if (searchKey && key.endsWith(searchKey)) {
                return obj;
            }
        }
    }
    // Fallback: buscar por nombre
    if (searchKey) {
        for (const [, obj] of allObjects) {
            const objName = obj.name;
            if (objName === searchKey) {
                return obj;
            }
        }
    }
    return null;
}
/**
 * Crea un EObject mínimo sin fábrica (para casos donde no hay EPackage registrado).
 */
function createMinimalEObject(eClass) {
    // No podemos instanciar EObjectImpl directamente (es abstracto).
    // En su lugar, creamos un objeto proxy simple que implementa la interfaz.
    // Esto es un fallback; lo ideal es usar la fábrica del paquete.
    // Como fallback, usamos un objeto genérico que delega en el eClass
    const handler = {
        _eClass: eClass,
        _featureValues: new Map(),
        _isSet: new Set(),
        _lists: new Map(),
        _eContainer: null,
        _eContainingFeature: null,
        _eResource: null,
        _eAdapters: [],
        _eDeliver: true,
        _eGetList: (feature, fid) => {
            let list = handler._lists.get(fid);
            if (!list) {
                list = new EListImpl({ unique: !feature.many ? false : true });
                handler._lists.set(fid, list);
            }
            return list;
        },
    };
    // Crear un objeto que implemente la interfaz EObject mínimamente
    const proto = {
        _eGetList: (feature, fid) => {
            let list = handler._lists.get(fid);
            if (!list) {
                list = new EListImpl({ unique: !feature.many ? false : true });
                handler._lists.set(fid, list);
            }
            return list;
        },
        eClass: () => eClass,
        eContainer: () => handler._eContainer,
        eContainingFeature: () => handler._eContainingFeature,
        eContainmentFeature: () => handler._eContainingFeature && 'containment' in handler._eContainingFeature
            ? handler._eContainingFeature
            : null,
        eResource: () => handler._eResource || (handler._eContainer ? handler._eContainer.eResource() : null),
        eContents: () => {
            const result = [];
            for (const f of eClass.eAllStructuralFeatures) {
                if (!('containment' in f))
                    continue;
                const ref = f;
                if (!ref.containment)
                    continue;
                const value = handler._featureValues.get(eClass.getFeatureID(f));
                if (ref.many && Array.isArray(value)) {
                    result.push(...value);
                }
                else if (value) {
                    result.push(value);
                }
            }
            return result;
        },
        eAllContents: function* () {
            const stack = [...this.eContents()];
            while (stack.length > 0) {
                const current = stack.shift();
                stack.unshift(...current.eContents());
                yield current;
            }
        },
        eCrossReferences: () => {
            const result = [];
            for (const f of eClass.eAllStructuralFeatures) {
                if (!('containment' in f))
                    continue;
                const ref = f;
                if (ref.containment)
                    continue;
                const value = handler._featureValues.get(eClass.getFeatureID(f));
                if (ref.many && Array.isArray(value)) {
                    result.push(...value);
                }
                else if (value) {
                    result.push(value);
                }
            }
            return result;
        },
        eGet: (feature, resolve) => {
            const fid = eClass.getFeatureID(feature);
            if (feature.many) {
                let list = handler._lists.get(fid);
                if (!list) {
                    list = new EListImpl({ unique: true });
                    handler._lists.set(fid, list);
                }
                return list;
            }
            if (handler._featureValues.has(fid))
                return handler._featureValues.get(fid);
            return feature.defaultValue;
        },
        eSet: (feature, value) => {
            if (!feature.changeable)
                throw new Error(`Feature ${feature.name} is not changeable`);
            const fid = eClass.getFeatureID(feature);
            const isContainment = 'containment' in feature && feature.containment;
            if (feature.many) {
                const list = handler._eGetList(feature, fid);
                list.clear();
                if (Array.isArray(value))
                    list.addAll(value);
                else if (value != null)
                    list.add(value);
                return;
            }
            if (isContainment) {
                const old = handler._featureValues.get(fid);
                if (old && typeof old.eSetContainer === 'function') {
                    old.eSetContainer(null, null);
                }
                if (value && typeof value.eSetContainer === 'function') {
                    value.eSetContainer(handler._eContainer || obj, feature);
                }
            }
            handler._featureValues.set(fid, value);
            handler._isSet.add(fid);
        },
        eIsSet: (feature) => {
            const fid = eClass.getFeatureID(feature);
            if (feature.many) {
                const list = handler._lists.get(fid);
                return list ? !list.isEmpty() : false;
            }
            if (feature.unsettable)
                return handler._isSet.has(fid);
            return handler._featureValues.has(fid) || handler._isSet.has(fid);
        },
        eUnset: (feature) => {
            const fid = eClass.getFeatureID(feature);
            if (feature.many) {
                const list = handler._lists.get(fid);
                if (list)
                    list.clear();
                return;
            }
            handler._featureValues.delete(fid);
            handler._isSet.delete(fid);
        },
        eInvoke: (_op, _args) => { throw new Error('eInvoke not supported on deserialized objects'); },
        eIsProxy: () => false,
        eAdapters: () => handler._eAdapters,
        eDeliver: () => handler._eDeliver,
        eSetDeliver: (d) => { handler._eDeliver = d; },
        eNotify: (_n) => { },
    };
    // Helper para getEList
    handler._eGetList = (feature, fid) => {
        let list = handler._lists.get(fid);
        if (!list) {
            list = new EListImpl({ unique: !feature.many ? false : true });
            handler._lists.set(fid, list);
        }
        return list;
    };
    const obj = Object.create(proto);
    return obj;
}
// ============================================================
// Serialización de EPackage
// ============================================================
/**
 * Serializa un EPackage completo a JSON compatible con emfjson.
 *
 * @param pkg - El EPackage a serializar
 * @returns String JSON del paquete completo
 */
export function serializeEPackage(pkg) {
    const data = serializeEPackageInternal(pkg, new Set());
    return JSON.stringify(data, null, 2);
}
/**
 * Serializa un EPackage a un objeto JSON.
 */
function serializeEPackageInternal(pkg, visited) {
    visited.add(pkg);
    const json = {
        eClass: getEClassFragment(pkg.eClass()),
        name: pkg.name,
        nsURI: pkg.nsURI,
        nsPrefix: pkg.nsPrefix,
    };
    // Serializar clasificadores
    if (pkg.eClassifiers.length > 0) {
        json.eClassifiers = pkg.eClassifiers.map(classifier => serializeClassifier(classifier, visited));
    }
    // Serializar subpaquetes
    if (pkg.eSubpackages.length > 0) {
        json.eSubpackages = pkg.eSubpackages
            .filter(sub => !visited.has(sub))
            .map(sub => serializeEPackageInternal(sub, visited));
    }
    return json;
}
/**
 * Serializa un clasificador a JSON.
 */
function serializeClassifier(classifier, visitedPackages) {
    const eClassUri = getEClassFragment(classifier.eClass());
    const json = {
        eClass: eClassUri,
        name: classifier.name,
    };
    if ('abstract' in classifier && classifier.abstract) {
        json.abstract = true;
    }
    if ('interface' in classifier && classifier.interface) {
        json.interface = true;
    }
    if ('serializable' in classifier && !classifier.serializable) {
        json.serializable = false;
    }
    // instanceClassName para EDataType
    if ('instanceClassName' in classifier) {
        json.instanceClassName = classifier.instanceClassName;
    }
    // EClass: serializar eSuperTypes, eStructuralFeatures, eOperations
    if ('eSuperTypes' in classifier) {
        const eClass = classifier;
        // eSuperTypes como fragment paths
        if (eClass.eSuperTypes.length > 0) {
            json.eSuperTypes = eClass.eSuperTypes.map(sup => getEClassFragment(sup));
        }
        // eStructuralFeatures
        if (eClass.eStructuralFeatures.length > 0) {
            json.eStructuralFeatures = eClass.eStructuralFeatures.map(f => serializeStructuralFeature(f));
        }
        // eOperations
        if (eClass.eOperations.length > 0) {
            json.eOperations = eClass.eOperations.map(op => serializeOperation(op));
        }
    }
    // EEnum: serializar literales
    if ('eLiterals' in classifier) {
        const eEnum = classifier;
        if (eEnum.eLiterals.length > 0) {
            json.eLiterals = eEnum.eLiterals.map((lit) => ({
                name: lit.name,
                value: lit.value,
                literal: lit.literal,
            }));
        }
    }
    return json;
}
/**
 * Serializa un EStructuralFeature a JSON.
 */
function serializeStructuralFeature(feature) {
    const json = {
        eClass: getEClassFragment(feature.eClass()),
        name: feature.name,
    };
    // Atributos comunes
    if (feature.lowerBound !== 0)
        json.lowerBound = feature.lowerBound;
    if (feature.upperBound !== 1)
        json.upperBound = feature.upperBound;
    if (!feature.changeable)
        json.changeable = false;
    if (feature.volatile)
        json.volatile = true;
    if (feature.transient)
        json.transient = true;
    if (feature.unsettable)
        json.unsettable = true;
    if (feature.derived)
        json.derived = true;
    if (!feature.ordered)
        json.ordered = false;
    if (!feature.unique)
        json.unique = false;
    // defaultVAlueLiteral
    if (feature.defaultValueLiteral) {
        json.defaultValueLiteral = feature.defaultValueLiteral;
    }
    // eType como fragment path
    if (feature.eType) {
        json.eType = getEClassFragment(feature.eType.eClass());
    }
    // EReference-specific
    if ('containment' in feature) {
        if (feature.containment)
            json.containment = true;
        if (!feature.resolveProxies)
            json.resolveProxies = false;
        // eOpposite como fragment path
        if (feature.eOpposite) {
            const oppClass = feature.eOpposite.eContainingClass;
            if (oppClass) {
                json.eOpposite = getFeatureFragment(oppClass, feature.eOpposite.name);
            }
        }
    }
    // EAttribute-specific
    if ('iD' in feature && feature.iD) {
        json.iD = true;
    }
    return json;
}
/**
 * Serializa una EOperation a JSON.
 */
function serializeOperation(operation) {
    const json = {
        eClass: getEClassFragment(operation.eClass()),
        name: operation.name,
    };
    if (operation.lowerBound !== 0)
        json.lowerBound = operation.lowerBound;
    if (operation.upperBound !== 1)
        json.upperBound = operation.upperBound;
    if (operation.eType) {
        json.eType = getEClassFragment(operation.eType.eClass());
    }
    // Parámetros
    if (operation.eParameters.length > 0) {
        json.eParameters = operation.eParameters.map((param) => ({
            eClass: getEClassFragment(param.eClass()),
            name: param.name,
            ...(param.eType ? { eType: getEClassFragment(param.eType.eClass()) } : {}),
        }));
    }
    return json;
}
//# sourceMappingURL=JSONSerializer.js.map