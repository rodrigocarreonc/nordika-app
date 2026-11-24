// Declaraciones de tipos para importar hojas CSS y CSS Modules en Expo Web sin errores de TS.

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.css" {
  const content: string;
  export default content;
}
