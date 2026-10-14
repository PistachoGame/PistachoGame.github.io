/**
 * CONFIGURACIÓN DE FIGURAS LOCALES PARA EL JUEGO "ADIVINA EL COLOR"
 * 
 * Este archivo permite al desarrollador definir figuras predefinidas que estarán
 * disponibles automáticamente en el juego sin necesidad de subirlas manualmente.
 * 
 * ESTRUCTURA DE CADA FIGURA:
 * {
 *     id: string (único, opcional - se genera automáticamente si no se proporciona)
 *     name: string (nombre descriptivo, opcional)
 *     url: string (ruta relativa o absoluta de la imagen, ej: "img/game/bob-esponja.png")
 *     lab: { L: number, a: number, b: number } (COLOR OBJETIVO en espacio CIELAB)
 *     tolerance: number (tolerancia de color para la máscara, 10-150, default: 50)
 * }
 * 
 * EJEMPLO:
 * {
 *     id: "bob-esponja",
 *     name: "Bob Esponja",
 *     url: "img/game/bob-esponja.png",
 *     lab: { L: 92.5, a: -5.2, b: 98.7 },  // Amarillo de Bob Esponja
 *     tolerance: 45
 * }
 * 
 * NOTAS IMPORTANTES:
 * - El color LAB debe corresponder al color EXACTO del píxel que se quiere ocultar
 * - Usa una herramienta como Photoshop, GIMP o https://colorjs.io/ para obtener valores LAB precisos
 * - La tolerancia controla cuántos píxeles similares se enmascaran (más alto = más área)
 * - Las imágenes deben estar en la carpeta img/game/ o usar rutas accesibles vía web
 * - CORS: Si usas URLs externas, asegúrate de que permitan cross-origin
 */

// Array de configuración de figuras (edita este array para agregar/quitar figuras)
const FIGURES_CONFIG = [
    {
        id: "pikachu",
        name: "Pikachú",
        url: "img/game/pikachu.webp",
        lab: { L: 85, a: 5, b: 77 },
        tolerance: 80
    }
    // EJEMPLO - Descomenta y modifica para usar:
    /*
    {
        id: "bob-esponja",
        name: "Bob Esponja",
        url: "img/game/bob-esponja.png",
        lab: { L: 92.5, a: -5.2, b: 98.7 },
        tolerance: 45
    },
    {
        id: "pikachu",
        name: "Pikachu",
        url: "img/game/pikachu.png",
        lab: { L: 88.3, a: 12.5, b: 95.2 },
        tolerance: 40
    }
    */
    
    // Agrega tus figuras aquí siguiendo la estructura del ejemplo de arriba
];

// Exportar para uso global (no necesario en navegador, pero útil para herramientas)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FIGURES_CONFIG };
}