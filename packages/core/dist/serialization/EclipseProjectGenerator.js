/**
 * @emf-webapp/core — EclipseProjectGenerator
 *
 * Generates Eclipse project metadata files required for a valid
 * Eclipse EMF/Sirius/EuGENia project that can be imported directly.
 *
 * Generated files:
 *   .project          — Eclipse project descriptor (natures, builders)
 *   .classpath        — Java classpath configuration
 *   META-INF/MANIFEST.MF — OSGi bundle manifest
 *   plugin.xml        — Eclipse plugin descriptor
 *   build.properties  — PDE build configuration
 *
 * References:
 *   - Eclipse PDE: https://www.eclipse.org/pde/
 *   - EMF Project Structure: https://wiki.eclipse.org/EMF/FAQ
 */
// ═══════════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════════
/**
 * Generates all Eclipse project metadata files.
 */
export function generateEclipseProjectFiles(options) {
    return {
        '.project': generateDotProject(options),
        '.classpath': generateClasspath(options),
        'META-INF/MANIFEST.MF': generateManifest(options),
        'plugin.xml': generatePluginXml(options),
        'build.properties': generateBuildProperties(options),
    };
}
// ═══════════════════════════════════════════════════════════════
// .project
// ═══════════════════════════════════════════════════════════════
function generateDotProject(options) {
    const natures = [
        'org.eclipse.jdt.core.javanature',
        'org.eclipse.pde.PluginNature',
        'org.eclipse.emf.ecore.xmi.nature',
    ];
    if (options.hasSirius) {
        natures.push('org.eclipse.sirius.nature.modelingproject');
    }
    const builders = [
        'org.eclipse.jdt.core.javabuilder',
        'org.eclipse.pde.ManifestBuilder',
        'org.eclipse.pde.SchemaBuilder',
    ];
    if (options.hasAcceleo) {
        builders.push('org.eclipse.acceleo.ide.ui.acceleoBuilder');
    }
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<projectDescription>');
    lines.push(`\t<name>${escapeXml(options.pluginId)}</name>`);
    lines.push(`\t<comment>${escapeXml(options.projectName)}</comment>`);
    lines.push('\t<projects>');
    lines.push('\t</projects>');
    lines.push('\t<buildSpec>');
    for (const builder of builders) {
        lines.push('\t\t<buildCommand>');
        lines.push(`\t\t\t<name>${builder}</name>`);
        lines.push('\t\t\t<arguments>');
        lines.push('\t\t\t</arguments>');
        lines.push('\t\t</buildCommand>');
    }
    lines.push('\t</buildSpec>');
    lines.push('\t<natures>');
    for (const nature of natures) {
        lines.push(`\t\t<nature>${nature}</nature>`);
    }
    lines.push('\t</natures>');
    lines.push('</projectDescription>');
    lines.push('');
    return lines.join('\n');
}
// ═══════════════════════════════════════════════════════════════
// .classpath
// ═══════════════════════════════════════════════════════════════
function generateClasspath(options) {
    const javaVersion = options.javaVersion || '17';
    const jreContainer = `org.eclipse.jdt.launching.JRE_CONTAINER/org.eclipse.jdt.internal.debug.ui.launcher.StandardVMType/JavaSE-${javaVersion}`;
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<classpath>');
    lines.push('\t<classpathentry kind="con" path="org.eclipse.jdt.launching.JRE_CONTAINER">');
    lines.push('\t\t<attributes>');
    lines.push(`\t\t\t<attribute name="module" value="true"/>`);
    lines.push('\t\t</attributes>');
    lines.push('\t</classpathentry>');
    lines.push('\t<classpathentry kind="con" path="org.eclipse.pde.core.requiredPlugins"/>');
    lines.push('\t<classpathentry kind="src" path="src"/>');
    lines.push('\t<classpathentry kind="src" path="src-gen"/>');
    lines.push('\t<classpathentry kind="output" path="bin"/>');
    lines.push('</classpath>');
    lines.push('');
    return lines.join('\n');
}
// ═══════════════════════════════════════════════════════════════
// META-INF/MANIFEST.MF
// ═══════════════════════════════════════════════════════════════
function generateManifest(options) {
    const emfVersion = options.emfVersion || '2.38.0';
    const vendor = options.vendor || 'emf-webapp';
    const requiredBundles = [
        'org.eclipse.core.runtime',
        `org.eclipse.emf.ecore;visibility:=reexport`,
        'org.eclipse.emf.ecore.xmi',
    ];
    if (options.hasOCL) {
        requiredBundles.push('org.eclipse.ocl.ecore');
        requiredBundles.push('org.eclipse.ocl.pivot');
    }
    if (options.hasSirius) {
        requiredBundles.push('org.eclipse.sirius');
        requiredBundles.push('org.eclipse.sirius.common');
    }
    if (options.hasAcceleo) {
        requiredBundles.push('org.eclipse.acceleo.engine');
        requiredBundles.push('org.eclipse.acceleo.common');
    }
    const exportedPackages = [
        `${options.pluginId}`,
        `${options.pluginId}.impl`,
        `${options.pluginId}.util`,
    ];
    const lines = [];
    lines.push('Manifest-Version: 1.0');
    lines.push(`Bundle-ManifestVersion: 2`);
    lines.push(`Bundle-Name: ${options.projectName}`);
    lines.push(`Bundle-SymbolicName: ${options.pluginId};singleton:=true`);
    lines.push(`Bundle-Version: 1.0.0.qualifier`);
    lines.push(`Bundle-ClassPath: .`);
    lines.push(`Bundle-Vendor: ${vendor}`);
    lines.push(`Bundle-Localization: plugin`);
    lines.push(`Bundle-RequiredExecutionEnvironment: JavaSE-${options.javaVersion || '17'}`);
    // Required-Bundles (multi-line with continuation)
    lines.push(`Require-Bundle: ${requiredBundles[0]},`);
    for (let i = 1; i < requiredBundles.length; i++) {
        const comma = i < requiredBundles.length - 1 ? ',' : '';
        lines.push(` ${requiredBundles[i]}${comma}`);
    }
    // Export-Package
    lines.push(`Export-Package: ${exportedPackages[0]},`);
    for (let i = 1; i < exportedPackages.length; i++) {
        const comma = i < exportedPackages.length - 1 ? ',' : '';
        lines.push(` ${exportedPackages[i]}${comma}`);
    }
    lines.push(`Bundle-ActivationPolicy: lazy`);
    lines.push('');
    return lines.join('\n');
}
// ═══════════════════════════════════════════════════════════════
// plugin.xml
// ═══════════════════════════════════════════════════════════════
function generatePluginXml(options) {
    const ecorePath = options.ecoreFilePath || `model/${options.packageName}.ecore`;
    const genmodelPath = options.genmodelFilePath || `model/${options.packageName}.genmodel`;
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<?eclipse version="3.0"?>');
    lines.push('<plugin>');
    lines.push('');
    // EMF EPackage registration
    lines.push('  <extension point="org.eclipse.emf.ecore.generated_package">');
    lines.push(`    <package`);
    lines.push(`      uri="${escapeXml(options.nsURI)}"`);
    lines.push(`      class="${options.pluginId}.${capitalize(options.nsPrefix)}Package"`);
    lines.push(`      genModel="${genmodelPath}"/>`);
    lines.push('  </extension>');
    lines.push('');
    // Resource factory registration
    lines.push('  <extension point="org.eclipse.emf.ecore.extension_parser">');
    lines.push(`    <parser`);
    lines.push(`      type="${options.nsPrefix}"`);
    lines.push(`      class="${options.pluginId}.util.${capitalize(options.nsPrefix)}ResourceFactoryImpl"/>`);
    lines.push('  </extension>');
    lines.push('');
    // Sirius viewpoint registration
    if (options.hasSirius) {
        lines.push('  <extension point="org.eclipse.sirius.componentization">');
        lines.push('    <component');
        lines.push(`      class="${options.pluginId}.design.Services"`);
        lines.push(`      id="${options.pluginId}.design"`);
        lines.push(`      name="${options.projectName} Design">`);
        lines.push('    </component>');
        lines.push('  </extension>');
        lines.push('');
    }
    // OCL delegate registration
    if (options.hasOCL) {
        lines.push('  <extension point="org.eclipse.emf.ecore.validation_delegate">');
        lines.push('    <delegate');
        lines.push('      uri="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot"');
        lines.push(`      class="org.eclipse.ocl.xtext.completeocl.validation.CompleteOCLEObjectValidator"/>`);
        lines.push('  </extension>');
        lines.push('');
    }
    lines.push('</plugin>');
    lines.push('');
    return lines.join('\n');
}
// ═══════════════════════════════════════════════════════════════
// build.properties
// ═══════════════════════════════════════════════════════════════
function generateBuildProperties(options) {
    const lines = [];
    lines.push('source.. = src/,\\');
    lines.push('          src-gen/');
    lines.push('output.. = bin/');
    lines.push('bin.includes = META-INF/,\\');
    lines.push('               .,\\');
    lines.push('               plugin.xml,\\');
    lines.push('               model/');
    if (options.hasSirius) {
        lines.push(',\\');
        lines.push('               description/');
    }
    if (options.hasAcceleo) {
        lines.push(',\\');
        lines.push('               templates/');
    }
    lines.push('');
    return lines.join('\n');
}
// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function capitalize(str) {
    if (!str)
        return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
//# sourceMappingURL=EclipseProjectGenerator.js.map