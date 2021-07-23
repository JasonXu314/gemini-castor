import { AbstractMesh, Color4, PointsCloudSystem, Vector3 } from '$lib/utils/babylon';
import OurBush3D from './utils/ourBush';
import { EventSrc, Logger, makePoint } from './utils/utils';

interface StructureEvents {
	STRUCT_SHOW: undefined;
	COMP_SHOW: undefined;
}

/** Class to handle all operations regarding structure data and rendering */
export default class StructureModule {
	/** The mesh representing structure; null if structure is not currently shown */
	private mesh: Mesh | null;

	/** The points cloud used to generate mesh; null if structure is not currently shown */
	private pcs: PointsCloudSystem | null;

	/** Logging module */
	private logger: Logger;

	/** Only used in case the user toggles the Show Compartments option */
	private currentRenderedData: RawStructureCoord[] | null;

	/** RBush containing all the structure points, enables quick searching */
	public structureBush: OurBush3D<SBushData>;

	/** The default data to be used for rendering the structure */
	public defaultStructureData: RawStructureCoord[] | null;

	/** Whether to show a/b compartments data */
	public compartmentsShown: boolean;

	/** Events system for structure module */
	public events: EventSrc<StructureEvents>;

	/** Max and min data for bounding boxes */
	public minX: number;
	public maxX: number;
	public minY: number;
	public maxY: number;
	public minZ: number;
	public maxZ: number;

	/**
	 * Creates a new structure module with the given data (note: does not generate the data until
	 * generateStructData is called, and does not render unless renderStruct is called with the desired coordinates)
	 * @param data all the structure coordinates to be considered when generating the structure
	 * @param scene the scene to render in
	 */
	constructor(public data: RawStructureCoord[], private scene: Scene) {
		this.structureBush = new OurBush3D<SBushData>();
		this.logger = new Logger('Structure');
		this.mesh = null;
		this.defaultStructureData = null;
		this.currentRenderedData = null;
		this.compartmentsShown = true;
		this.events = new EventSrc(['STRUCT_SHOW', 'COMP_SHOW']);
		this.minX = 0;
		this.maxX = 0;
		this.minY = 0;
		this.maxY = 0;
		this.minZ = 0;
		this.maxZ = 0;
		this.logger.log('Initialized');
	}

	/**
	 * Populates the bush with data, and generates the default structure data
	 * TODO: implement k-means clustering for (hopefully) faster search times
	 */
	public generateStructData(): void {
		this.data.forEach((coord) => {
			const { x, y, z, compartment } = coord;
			const pt = makePoint<SBushData>(x, y, z, { compartment, sorted: false, raw: coord });

			if (x < this.minX) {
				this.minX = x;
			}
			if (x > this.maxX) {
				this.maxX = x;
			}
			if (y < this.minY) {
				this.minY = y;
			}
			if (y > this.maxY) {
				this.maxY = y;
			}
			if (z < this.minZ) {
				this.minZ = z;
			}
			if (z > this.maxZ) {
				this.maxZ = z;
			}

			this.structureBush.insert(pt);
		});

		this.defaultStructureData =
			this.data.length < 100000
				? this.data
				: (() => {
						const out: RawStructureCoord[] = [];

						const step = Math.ceil(this.data.length / 100000);
						for (let i = 0; i < this.data.length / step; i += step) {
							out.push(this.data[i]);
						}

						return out;
				  })();
	}

	/**
	 * Uses the points cloud system to generate the structure mesh from the given points
	 * @param points the desired structure coordinates to render
	 * @returns a promise that will resolve when the mesh is built
	 */
	public renderStruct(points: RawStructureCoord[]): Promise<void> {
		return new Promise((resolve) => {
			this.logger.log('Re-rendering struct');
			if (this.mesh !== null) {
				this.clearMeshes();
			}

			this.pcs = new PointsCloudSystem('structpcs', 2, this.scene, { updatable: false });
			this.pcs.addPoints(points.length, (particle: CloudPoint, i: number) => {
				particle.position = new Vector3(points[i].x, points[i].y, points[i].z);

				if (this.compartmentsShown) {
					if (points[i].compartment === 'A') {
						particle.color = new Color4(0, 1, 0, 1);
					} else if (points[i].compartment === 'B') {
						particle.color = new Color4(1, 0, 0, 1);
					}
				} else {
					particle.color = new Color4(1, 1, 1, 1);
				}
			});

			this.pcs.buildMeshAsync().then((mesh) => {
				mesh.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
				mesh.freezeWorldMatrix();
				mesh.doNotSyncBoundingInfo = true;
				mesh.freezeNormals();
				mesh.isPickable = false;
				this.mesh = mesh;

				this.logger.log('Mesh generated');
				this.currentRenderedData = points;
				this.events.dispatch('STRUCT_SHOW');
				resolve();
			});
		});
	}

	/** Gives user option to toggle off the structure rendering */
	public setStructShown(shown: boolean): void {
		if (this.mesh !== null && shown !== this.mesh.isEnabled()) {
			this.mesh.setEnabled(shown);
		}
	}

	/** Gives user option to toggle off compartment data rendering */
	public setCompartmentsShown(shown: boolean): void {
		if (this.compartmentsShown !== shown) {
			this.compartmentsShown = shown;
			if (this.mesh !== null) {
				const shown = this.mesh.isEnabled();
				this.renderStruct(this.currentRenderedData).then(() => {
					if (!shown) {
						this.mesh.setEnabled(false);
					}
				});
			}
		}
	}

	/** Clears the mesh & points cloud system (used before re-rendering) */
	public clearMeshes(): void {
		this.logger.log('Clearing meshes');
		this.mesh.dispose();
		this.pcs.dispose();
		this.mesh = null;
		this.pcs = null;
		this.currentRenderedData = null;
	}
}
