import axios from 'axios';
import { v4 as uuid } from 'uuid';
import type GameLite from './game';
import type GUIModule from './gui';
import { Color3, MeshBuilder, StandardMaterial, Vector3 } from './utils/babylon';
import { BACKEND_URL } from './utils/constants';
import { EventSrc, Logger, modColor } from './utils/utils';

/** Helper type to define what inputs you can pass to updateBound */
type Bound = 'minX' | 'maxX' | 'minY' | 'maxY' | 'minZ' | 'maxZ';

interface HighlightEvents {
	CREATED_HIGHLIGHT: RawHighlight;
	EDITED_HIGHLIGHT: { id: string; name: string };
	DELETED_HIGHLIGHT: RawHighlight;
	CHANGED_HIGHLIGHT_COLOR: { id: string; color: RawColor3 };
}

export default class HighlightsModule {
	/** Logger module */
	private logger: Logger;

	public events: EventSrc<HighlightEvents>;

	/** Meshes */
	public highlightMeshes: Map<string, Mesh>;

	/** Highlight data */
	public highlights: Map<string, RawHighlight>;

	/** Toggling stuff **/
	private on: boolean;
	private shown: Map<string, boolean>;

	/** Radius Highlight parameters */
	public radiusHighlight: RadSelectParams | null;
	public radiusGuide: Mesh | null;
	public volumeHighlight: VolSelectParams | null;

	// Guide Meshes
	private floor: Mesh | null;
	private ceiling: Mesh | null;
	private wallN: Mesh | null;
	private wallS: Mesh | null;
	private wallW: Mesh | null;
	private wallE: Mesh | null;
	private wallMat: StandardMaterial | null;

	/** Whether the user is placing the selection mesh */
	public initPos: boolean;

	/** If the user has placed the selection mesh, but has not locked in the highlight parameters */
	public settingParams: boolean;

	/** If the sort is canceled while placing the radius selector, will be called to let component know */
	private rejectStart: (() => void) | null;

	constructor(private gui: GUIModule, private canvas: HTMLCanvasElement, private scene: Scene, private game: GameLite) {
		this.logger = new Logger('Highlights');

		this.events = new EventSrc<HighlightEvents>([
			'CREATED_HIGHLIGHT',
			'DELETED_HIGHLIGHT',
			'EDITED_HIGHLIGHT',
			'CHANGED_HIGHLIGHT_COLOR'
		]);

		this.highlightMeshes = new Map();
		this.highlights = new Map();
		this.shown = new Map();
		this.on = true;

		this.radiusHighlight = null;
		this.radiusGuide = null;
		this.rejectStart = null;

		this.logger.log('Initialized');
	}

	/**
	 * Loads a single raw highlight
	 * @param highlight the raw highlight to be loaded
	 */
	public loadHighlight(highlight: RawHighlight): void {
		if (!this.highlights.has(highlight.id)) {
			if (highlight.type === 'radius') {
				const {
					position: { x, y, z },
					radius
				} = highlight.params;
				const { r, g, b } = highlight.color;
				const meshMat = new StandardMaterial(`highlight-${highlight.id}-mat`, this.scene);
				meshMat.diffuseColor = new Color3(r, g, b);
				meshMat.alpha = 0.25;
				meshMat.backFaceCulling = false;

				const mesh = MeshBuilder.CreateSphere(
					`highlight-${highlight.id}`,
					{ segments: 8, diameter: 2, updatable: true },
					this.scene
				);
				mesh.material = meshMat;
				mesh.scaling = new Vector3(radius, radius, radius);
				mesh.position = new Vector3(x, y, z);

				this.highlights.set(highlight.id, highlight);
				this.highlightMeshes.set(highlight.id, mesh);
				this.shown.set(highlight.id, true);
			} else {
				const { maxX, maxY, maxZ, minX, minY, minZ } = highlight.params;
				const { r, g, b } = highlight.color;
				const meshMat = new StandardMaterial(`highlight-${highlight.id}-mat`, this.scene);
				meshMat.diffuseColor = new Color3(r, g, b);
				meshMat.alpha = 0.25;
				meshMat.backFaceCulling = false;

				const mesh = MeshBuilder.CreateBox(`highlight-${highlight.id}`, {
					height: maxY - minY,
					width: maxX - minX,
					depth: maxZ - minZ
				});
				mesh.material = meshMat;
				mesh.position = new Vector3((maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2);

				this.highlights.set(highlight.id, highlight);
				this.highlightMeshes.set(highlight.id, mesh);
				this.shown.set(highlight.id, true);
			}
			// @ts-ignore no clue why ts fucks up here, but it should work nonetheless
			this.events.dispatch('CREATED_HIGHLIGHT', highlight);
		}
	}

	/**
	 * Loads the given raw highlights, generating meshes to display them
	 * @param highlights the raw highlights to be loaded
	 */
	public loadHighlights(highlights: RawHighlight[]): void {
		highlights.forEach((highlight) => this.loadHighlight(highlight));
	}

	/**
	 * Sets a general rule for showing highlights, if hidden, overrides individual show/hide status
	 * @param shown whether tho show highlights or not
	 */
	public setHighlightsShown(shown: boolean): void {
		if (shown !== this.on) {
			this.on = shown;
			[...this.shown.entries()].forEach(([id, entryShown]) => {
				if (!shown && entryShown) {
					this.highlightMeshes.get(id).setEnabled(false);
					this.gui.checkVisible();
				} else if (shown && entryShown) {
					this.highlightMeshes.get(id).setEnabled(true);
					this.gui.checkVisible();
				}
			});
		}
	}

	/**
	 * Shows/Hides a single highlight
	 * @param id the id of the highlight to show/hide
	 * @param shown whether to show the highlight or not
	 */
	public setShown(id: string, shown: boolean): void {
		if (this.shown.get(id) !== shown) {
			this.shown.set(id, shown);
			this.highlightMeshes.get(id).setEnabled(shown);
		}
	}

	/**
	 * Starts the process to create a radius highlight
	 * @returns A promise that resolves when the user has placed the guide mesh
	 */
	public async startRadius(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.radiusHighlight || this.volumeHighlight) {
				resolve();
				return;
			}

			// Create guidance mesh
			this.radiusHighlight = {
				position: { x: 0, y: 0, z: 0 },
				radius: 300
			};
			const guideMesh = MeshBuilder.CreateSphere(
				'sphericalbound',
				{ segments: 8, diameter: 2, updatable: true },
				this.scene
			);
			guideMesh.material = new StandardMaterial('guideballmaterial', this.scene);
			guideMesh.material.wireframe = true;
			guideMesh.scaling = new Vector3(300, 300, 300);
			guideMesh.isPickable = false;
			this.radiusGuide = guideMesh;

			this.initPos = true;

			this.rejectStart = reject;

			// Listen for double click, to finalize position of highlight
			this.canvas.addEventListener(
				'dblclick',
				() => {
					this.initPos = false;
					this.settingParams = true;
					this.radiusHighlight.position = guideMesh.position.clone();
					this.rejectStart = null;

					// Tell component that highlight is done placing
					resolve();
				},
				{ once: true }
			);
		});
	}

	/** Start placing the highlight (ie. display the guide mesh) */
	public startVolume(): void {
		this.volumeHighlight = { maxX: 1000, maxY: 1000, maxZ: 1000, minX: -1000, minY: -1000, minZ: -1000 };
		this.settingParams = true;

		// Create one material for all the walls
		const planeMat = new StandardMaterial('planemat', this.scene);
		planeMat.wireframe = true;

		// Create walls
		this.wallE = MeshBuilder.CreatePlane('wallE', { width: 1, height: 1 }, this.scene);
		this.wallE.rotation = new Vector3(0, Math.PI / 2, 0);
		this.wallE.material = planeMat;
		this.wallW = MeshBuilder.CreatePlane('wallW', { width: 1, height: 1 }, this.scene);
		this.wallW.rotation = new Vector3(0, Math.PI / 2, 0);
		this.wallW.material = planeMat;
		this.wallN = MeshBuilder.CreatePlane('wallN', { width: 1, height: 1 }, this.scene);
		this.wallN.material = planeMat;
		this.wallS = MeshBuilder.CreatePlane('wallS', { width: 1, height: 1 }, this.scene);
		this.wallS.material = planeMat;
		this.ceiling = MeshBuilder.CreatePlane('ceiling', { width: 1, height: 1 }, this.scene);
		this.ceiling.rotation = new Vector3(Math.PI / 2, 0, 0);
		this.ceiling.material = planeMat;
		this.floor = MeshBuilder.CreatePlane('floor', { width: 1, height: 1 }, this.scene);
		this.floor.rotation = new Vector3(Math.PI / 2, 0, 0);
		this.floor.material = planeMat;
		this.wallMat = planeMat;

		this.wallE.isPickable = false;
		this.wallW.isPickable = false;
		this.wallN.isPickable = false;
		this.wallS.isPickable = false;
		this.ceiling.isPickable = false;
		this.floor.isPickable = false;

		// Update positions, to get walls in the correct positions
		this.updateWalls();
	}

	/**
	 * Cancels radius/volume highlight, depending on which one is running
	 */
	public cancel(): void {
		if (this.initPos) {
			this.initPos = false;

			if (this.radiusHighlight) {
				this.radiusGuide.dispose();
				this.radiusGuide = null;
				this.radiusHighlight = null;
				this.rejectStart();
				this.rejectStart = null;
			} else if (this.volumeHighlight) {
				this.wallE.dispose();
				this.wallW.dispose();
				this.wallN.dispose();
				this.wallS.dispose();
				this.ceiling.dispose();
				this.floor.dispose();
				this.wallE = null;
				this.wallW = null;
				this.wallN = null;
				this.wallS = null;
				this.ceiling = null;
				this.floor = null;
				this.volumeHighlight = null;
			}
		} else if (this.settingParams) {
			if (this.radiusHighlight) {
				this.settingParams = false;
				this.radiusHighlight = null;
				this.radiusGuide.dispose();
				this.radiusGuide = null;
			} else if (this.volumeHighlight) {
				this.wallE.dispose();
				this.wallW.dispose();
				this.wallN.dispose();
				this.wallS.dispose();
				this.ceiling.dispose();
				this.floor.dispose();
				this.wallE = null;
				this.wallW = null;
				this.wallN = null;
				this.wallS = null;
				this.ceiling = null;
				this.floor = null;
				this.volumeHighlight = null;
			}
		}
	}

	/**
	 * Updates a boundary of the highlight, and triggers the appropriate function(s) to modify the mesh in babylon
	 * @param bound the bound to be updated (must be minX, maxX, minY, maxY, minZ, or maxZ)
	 * @param value the new value of the bound
	 */
	public updateBound(bound: Bound, value: number) {
		if (this.volumeHighlight) {
			this.volumeHighlight[bound] = value;
			this.updateWalls();
		}
	}

	/** Updates the meshes for the walls in response to updated bounds (only called in updateBounds) */
	private updateWalls(): void {
		this.wallE.position = new Vector3(
			this.volumeHighlight.minX,
			(this.volumeHighlight.maxY + this.volumeHighlight.minY) / 2,
			(this.volumeHighlight.maxZ + this.volumeHighlight.minZ) / 2
		);
		this.wallE.scaling = new Vector3(
			this.volumeHighlight.maxZ - this.volumeHighlight.minZ,
			this.volumeHighlight.maxY - this.volumeHighlight.minY,
			0
		);
		this.wallW.position = new Vector3(
			this.volumeHighlight.maxX,
			(this.volumeHighlight.maxY + this.volumeHighlight.minY) / 2,
			(this.volumeHighlight.maxZ + this.volumeHighlight.minZ) / 2
		);
		this.wallW.scaling = new Vector3(
			this.volumeHighlight.maxZ - this.volumeHighlight.minZ,
			this.volumeHighlight.maxY - this.volumeHighlight.minY,
			0
		);
		this.wallN.position = new Vector3(
			(this.volumeHighlight.maxX + this.volumeHighlight.minX) / 2,
			(this.volumeHighlight.maxY + this.volumeHighlight.minY) / 2,
			this.volumeHighlight.maxZ
		);
		this.wallN.scaling = new Vector3(
			this.volumeHighlight.maxX - this.volumeHighlight.minX,
			this.volumeHighlight.maxY - this.volumeHighlight.minY,
			0
		);
		this.wallS.position = new Vector3(
			(this.volumeHighlight.maxX + this.volumeHighlight.minX) / 2,
			(this.volumeHighlight.maxY + this.volumeHighlight.minY) / 2,
			this.volumeHighlight.minZ
		);
		this.wallS.scaling = new Vector3(
			this.volumeHighlight.maxX - this.volumeHighlight.minX,
			this.volumeHighlight.maxY - this.volumeHighlight.minY,
			0
		);
		this.ceiling.position = new Vector3(
			(this.volumeHighlight.maxX + this.volumeHighlight.minX) / 2,
			this.volumeHighlight.maxY,
			(this.volumeHighlight.maxZ + this.volumeHighlight.minZ) / 2
		);
		this.ceiling.scaling = new Vector3(
			this.volumeHighlight.maxX - this.volumeHighlight.minX,
			this.volumeHighlight.maxZ - this.volumeHighlight.minZ,
			0
		);
		this.floor.position = new Vector3(
			(this.volumeHighlight.maxX + this.volumeHighlight.minX) / 2,
			this.volumeHighlight.minY,
			(this.volumeHighlight.maxZ + this.volumeHighlight.minZ) / 2
		);
		this.floor.scaling = new Vector3(
			this.volumeHighlight.maxX - this.volumeHighlight.minX,
			this.volumeHighlight.maxZ - this.volumeHighlight.minZ,
			0
		);
	}

	/**
	 * Resets the highlight setting process (could be duplicate of cancel), dunno
	 */
	public reset(): void {
		this.initPos = false;
		this.settingParams = false;

		if (this.radiusHighlight) {
			this.radiusGuide.dispose();
			this.radiusGuide = null;
			this.radiusHighlight = null;
		} else if (this.volumeHighlight) {
			this.wallE.dispose();
			this.wallW.dispose();
			this.wallN.dispose();
			this.wallS.dispose();
			this.ceiling.dispose();
			this.floor.dispose();
			this.wallE = null;
			this.wallW = null;
			this.wallN = null;
			this.wallS = null;
			this.ceiling = null;
			this.floor = null;
			this.volumeHighlight = null;
		}
	}

	/**
	 * Updates a coordinate of the center position of the radius highlight
	 * @param coord the coordinate to update
	 * @param value the new value of the given coordinate
	 */
	public updateRadiusPos(coord: 'x' | 'y' | 'z', value: number): void {
		if (this.radiusHighlight) {
			this.radiusHighlight[coord] = value;
			this.radiusGuide.position[coord] = value;
		}
	}

	/**
	 * Updates the radius of the radius highlight
	 * @param radius the new radius
	 */
	public updateRadius(radius: number): void {
		if (this.radiusHighlight) {
			this.radiusHighlight.radius = radius;
			this.radiusGuide.scaling = new Vector3(radius, radius, radius);
		}
	}

	/**
	 * Builds the highlight mesh for a radius highlight from the given parameters
	 */
	public createRadiusHighlight(): void {
		if (this.radiusHighlight) {
			const id = uuid();
			const {
				position: { x, y, z },
				radius
			} = this.radiusHighlight;

			const newHighlight: RadiusHighlight = {
				id,
				name: `Highlight ${this.highlights.size + 1}`,
				params: { position: { x, y, z }, radius },
				type: 'radius',
				color: { r: 0, g: 0, b: 1 }
			};

			const meshMat = new StandardMaterial(`highlight-${id}-mat`, this.scene);
			meshMat.diffuseColor = new Color3(0, 0, 1);
			meshMat.alpha = 0.25;
			meshMat.backFaceCulling = false;

			const mesh = MeshBuilder.CreateSphere(
				`highlight-${id}`,
				{ segments: 8, diameter: 2, updatable: true },
				this.scene
			);
			mesh.material = meshMat;
			mesh.scaling = new Vector3(radius, radius, radius);
			mesh.position = new Vector3(x, y, z);

			this.highlights.set(id, newHighlight);
			this.highlightMeshes.set(id, mesh);
			this.shown.set(id, true);
			this.radiusHighlight = null;
			this.radiusGuide.dispose();
			this.radiusGuide = null;

			axios.post<RawHighlight>(`${BACKEND_URL}/highlights`, {
				id: this.game.rawData.id,
				highlight: newHighlight
			});
			this.events.dispatch('CREATED_HIGHLIGHT', newHighlight);
		}
	}

	/**
	 * Builds the highlight mesh for a volume highlight from the given parameters
	 */
	public createVolumeHighlight(): void {
		if (this.volumeHighlight) {
			const id = uuid();
			const { maxX, maxY, maxZ, minX, minY, minZ } = this.volumeHighlight;

			const newHighlight: VolumeHighlight = {
				id,
				name: `Highlight ${this.highlights.size + 1}`,
				params: { maxX, maxY, maxZ, minX, minY, minZ },
				type: 'volume',
				color: { r: 0, g: 0, b: 1 }
			};

			const meshMat = new StandardMaterial(`highlight-${id}-mat`, this.scene);
			meshMat.diffuseColor = new Color3(0, 0, 1);
			meshMat.alpha = 0.25;
			meshMat.backFaceCulling = false;

			const mesh = MeshBuilder.CreateBox(`highlight-${id}`, {
				height: maxY - minY,
				width: maxX - minX,
				depth: maxZ - minZ
			});
			mesh.material = meshMat;
			mesh.position = new Vector3((maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2);

			this.highlights.set(id, newHighlight);
			this.highlightMeshes.set(id, mesh);
			this.shown.set(id, true);
			this.volumeHighlight = null;
			this.wallE.dispose();
			this.wallW.dispose();
			this.wallN.dispose();
			this.wallS.dispose();
			this.ceiling.dispose();
			this.floor.dispose();
			this.wallE = null;
			this.wallW = null;
			this.wallN = null;
			this.wallS = null;
			this.ceiling = null;
			this.floor = null;

			axios.post<RawHighlight>(`${BACKEND_URL}/highlights`, {
				id: this.game.rawData.id,
				highlight: newHighlight
			});
			this.events.dispatch('CREATED_HIGHLIGHT', newHighlight);
		}
	}

	/**
	 * Deletes a highlight with given id
	 * @param id The id of the highlight to delete
	 */
	public deleteHighlight(id: string): void {
		if (this.highlights.has(id)) {
			const mesh = this.highlightMeshes.get(id);
			const highlight = this.highlights.get(id);

			if (this.gui.hasAnnotation(mesh)) {
				this.gui.removeAnnotationFromMesh(mesh);
			}

			mesh.dispose();

			this.highlights.delete(id);
			this.highlightMeshes.delete(id);
			// @ts-ignore no clue why ts fucks up here, but it should work nonetheless
			this.events.dispatch('DELETED_HIGHLIGHT', highlight);
		}
	}

	/**
	 * Changes the name of the highlight with given id
	 * @param id the id of the highlight to edit
	 * @param name the new name of the highlight
	 */
	public editHighlight(id: string, name: string): void {
		if (this.highlights.has(id)) {
			const highlight = this.highlights.get(id);
			if (highlight.name !== name) {
				highlight.name = name;
				this.events.dispatch('EDITED_HIGHLIGHT', { id, name });
			}
		}
	}

	/**
	 * Changes the color of the highlight with given id
	 * @param id the id of the highlight to edit
	 * @param color the new color of the highlight
	 */
	public changeHighlightColor(id: string, color: RawColor3): void {
		if (this.highlights.has(id)) {
			const highlight = this.highlights.get(id);
			const { r, g, b } = highlight.color;
			if (r !== color.r || g !== color.g || b !== color.b) {
				highlight.color = color;
				const highlightMesh = this.highlightMeshes.get(id)!;
				const newColor = new Color3(color.r, color.g, color.b);

				if (this.game.selectedMesh === highlightMesh) {
					(highlightMesh.material as StandardMaterial).diffuseColor = modColor(newColor);
					this.game.selectedOriginalColor = newColor;
				} else if (this.game.hoverMesh === highlightMesh) {
					(highlightMesh.material as StandardMaterial).diffuseColor = modColor(newColor);
					this.game.originalColor = newColor;
				} else {
					(highlightMesh.material as StandardMaterial).diffuseColor = newColor;
				}

				this.events.dispatch('CHANGED_HIGHLIGHT_COLOR', { id, color });
			}
		}
	}

	/** Update the position the radius guide mesh; called by the main game class */
	public updateRadiusGuide(): void {
		if (this.game.hoverMesh) {
			this.radiusGuide.position = this.game.hoverMesh.getBoundingInfo().boundingSphere.center.clone();
			this.radiusHighlight.radius = this.game.hoverMesh.getBoundingInfo().boundingSphere.radius;
			this.radiusGuide.scaling = new Vector3(
				this.radiusHighlight.radius,
				this.radiusHighlight.radius,
				this.radiusHighlight.radius
			);
		} else {
			const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
			this.radiusGuide.position = this.scene.activeCamera.position.add(pickInfo.ray.direction.scale(2000));
			if (this.radiusHighlight.radius !== 300) {
				this.radiusHighlight.radius = 300;
				this.radiusGuide.scaling = new Vector3(
					this.radiusHighlight.radius,
					this.radiusHighlight.radius,
					this.radiusHighlight.radius
				);
			}
		}
	}
}
