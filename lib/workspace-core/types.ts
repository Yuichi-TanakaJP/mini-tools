export type WorkspaceCoreProductSummary = {
  productId: string;
  slug: string;
  name: string;
  description: string | null;
  productType: string;
  lifecycleStatus: string;
  importance: number;
  updatedAt: string | null;
  repositoryCount: number;
  technologyCount: number;
  providerCount: number;
  relationCount: number;
};

export type WorkspaceCoreRepositoryLink = {
  productSlug: string;
  repositoryId: string;
  fullName: string;
  visibility: string;
  defaultBranch: string | null;
  archived: boolean;
  htmlUrl: string | null;
  role: string;
  isPrimary: boolean;
  source: string;
  confidence: number;
  verifiedAt: string | null;
  notes: string | null;
};

export type WorkspaceCoreTechnologyLink = {
  productSlug: string;
  technologyId: string;
  technologySlug: string;
  technologyName: string;
  category: string;
  layer: string | null;
  role: string | null;
  version: string | null;
  source: string;
  confidence: number;
  evidenceUri: string | null;
  lastVerifiedAt: string | null;
  notes: string | null;
};

export type WorkspaceCoreProviderLink = {
  productSlug: string;
  providerId: string;
  providerSlug: string;
  providerName: string;
  providerCategory: string;
  relationType: string;
  source: string;
  confidence: number;
  evidenceUri: string | null;
  lastVerifiedAt: string | null;
  notes: string | null;
};

export type WorkspaceCoreServiceInstanceLink = {
  productSlug: string;
  providerSlug: string;
  providerName: string;
  serviceInstanceId: string;
  externalId: string | null;
  instanceName: string;
  accountScope: string;
  environment: string;
  region: string | null;
  url: string | null;
  status: string;
  relationType: string;
  source: string;
  confidence: number;
  verifiedAt: string | null;
  notes: string | null;
};

export type WorkspaceCoreProductRelation = {
  sourceProductSlug: string;
  sourceProductName: string;
  targetProductSlug: string;
  targetProductName: string;
  relationType: string;
  source: string;
  confidence: number;
  verifiedAt: string | null;
  notes: string | null;
};

export type WorkspaceCoreServiceSummary = {
  serviceId: string;
  slug: string;
  name: string;
  summary: string | null;
  targetUser: string | null;
  userJob: string | null;
  valueProposition: string | null;
  expectedOutcome: string | null;
  stage: string;
  importance: number;
  modelStatus: string;
  updatedAt: string | null;
  productCount: number;
  deliveryModeCount: number;
};

export type WorkspaceCoreServiceProductLink = {
  serviceSlug: string;
  serviceName: string;
  productSlug: string;
  productName: string;
  role: string;
  contribution: string | null;
  isPrimary: boolean;
  source: string;
  confidence: number;
  evidenceUri: string | null;
  verifiedAt: string | null;
  notes: string | null;
};

export type WorkspaceCoreServiceDeliveryMode = {
  serviceSlug: string;
  serviceName: string;
  productSlug: string | null;
  productName: string | null;
  mode: string;
  label: string;
  description: string | null;
  touchpoint: string | null;
  isUserFacing: boolean;
  source: string;
  confidence: number;
  evidenceUri: string | null;
  verifiedAt: string | null;
  notes: string | null;
};

export type WorkspaceCoreOverview = {
  products: WorkspaceCoreProductSummary[];
  repositories: WorkspaceCoreRepositoryLink[];
  technologies: WorkspaceCoreTechnologyLink[];
  providerLinks: WorkspaceCoreProviderLink[];
  serviceInstances: WorkspaceCoreServiceInstanceLink[];
  relations: WorkspaceCoreProductRelation[];
  services: WorkspaceCoreServiceSummary[];
  serviceProducts: WorkspaceCoreServiceProductLink[];
  serviceDeliveryModes: WorkspaceCoreServiceDeliveryMode[];
};

export type WorkspaceCoreProductDetail = {
  product: WorkspaceCoreProductSummary;
  repositories: WorkspaceCoreRepositoryLink[];
  technologies: WorkspaceCoreTechnologyLink[];
  providers: WorkspaceCoreProviderLink[];
  serviceInstances: WorkspaceCoreServiceInstanceLink[];
  outgoingRelations: WorkspaceCoreProductRelation[];
  incomingRelations: WorkspaceCoreProductRelation[];
};

export type WorkspaceCoreProviderImpact = {
  providerSlug: string;
  links: WorkspaceCoreProviderLink[];
};

export type WorkspaceCoreApiStatus = "ok" | "unconfigured" | "unauthenticated" | "not_found" | "error";

export type WorkspaceCoreApiResponse<T> = {
  status: WorkspaceCoreApiStatus;
  data: T | null;
  message?: string;
};
