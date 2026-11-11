export const SOURCE = {
  /** Lithuanian shelter network ("Priedangų tinklas Lietuvoje"), published by PAGD on open.geodata.gov.lt. */
  datasetUrl: "https://open.geodata.gov.lt/datasets/8a1e4b06ca714e2983b67c737c667abe_0",
  layerUrl:
    "https://services-eu1.arcgis.com/rHAjZpbf6qHK8UCL/arcgis/rest/services/Priedang%C5%B3_tinklas_Lietuvoje_(TEST)/FeatureServer/0",
  pageSize: 2000,
} as const;

export const DB_PATH = process.env.DB_PATH ?? "data/priedangos.sqlite";
/** Compact dataset served by the website. */
export const WEB_DATA_PATH = process.env.WEB_DATA_PATH ?? "web/public/data/shelters.json";
export const EXPORT_PATH = process.env.EXPORT_PATH ?? "data/priedangos.geojson";

/**
 * If a sync sees fewer than this share of the currently active shelters, it refuses
 * to mark the missing ones as removed (protects against a half-published source).
 */
export const MIN_ACTIVE_RATIO = 0.8;
