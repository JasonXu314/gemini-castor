import { AdvancedDynamicTexture, Rectangle, Scene, TextBlock } from './utils/babylon';
import { EventSrc, Logger } from './utils/utils';

interface GUIEvents {
	CREATED_ANNOTATION: AbstractMesh;
	DELETED_ANNOTATION: AbstractMesh;
}

export default class GUIModule {
	/** Logging module */
	private logger: Logger;

	public events: EventSrc<GUIEvents>;

	// GUI stuff
	public gui: AdvancedDynamicTexture;
	private unloadedAnnotations: RawAnnotation[];
	public annotationsShown: boolean;

	/** Keeping track of annotations to dispose later if necessary */
	private annotations: Map<AbstractMesh, Rectangle>;

	constructor(private scene: Scene) {
		this.logger = new Logger('GUI');

		this.events = new EventSrc(['CREATED_ANNOTATION', 'DELETED_ANNOTATION']);

		this.gui = AdvancedDynamicTexture.CreateFullscreenUI('annotation-ui');
		this.annotationsShown = true;
		this.unloadedAnnotations = [];

		this.annotations = new Map();

		this.logger.log('Initialized');
	}

	/**
	 * Loads the given raw annotations, creating GUI elements for ones whose meshes are rendered, and storing the rest
	 * in unloadedAnnotations
	 * @param annotations the raw annotations to load
	 */
	public loadAnnotations(annotations: RawAnnotation[]): void {
		annotations.forEach((ann) => this.loadAnnotation(ann));
	}

	/**
	 * Loads a single raw annotation
	 * @param annotation the raw annotation to load
	 */
	public loadAnnotation(annotation: RawAnnotation): void {
		const mesh = this.scene.getMeshByName(annotation.mesh);

		if (!mesh) {
			this.unloadedAnnotations.push(annotation);
		} else if (!this.hasAnnotation(mesh)) {
			// store the annotation for later, in case the mesh ever does get rendered
			this.makeAnnotation(mesh, annotation.text);
		}
	}

	/**
	 * Creates the GUI element for an annotation
	 * @param mesh the mesh that the annotation is attached to
	 * @param annotation the text of the annotation
	 */
	public makeAnnotation(mesh: AbstractMesh, annotation: string): void {
		// Make body for the BABYLON gui representation of the annotation
		const rect = new Rectangle(mesh.name + '-annotation-body');
		rect.background = 'rgba(0, 0, 0, 0.5)';
		rect.height = annotation.split('\n').length * 24 + 16 + 'px';
		rect.width =
			annotation
				.split('\n')
				.map((str) => str.length)
				.reduce((max, num) => Math.max(max, num), 0) *
				12 +
			'px';

		// Make the text
		const text = new TextBlock(mesh.name + '-annotation-text', annotation);
		text.color = 'white';
		rect.addControl(text);
		rect.isVisible = this.annotationsShown;
		this.gui.addControl(rect);
		rect.linkWithMesh(mesh);
		this.annotations.set(mesh, rect);

		this.events.dispatch('CREATED_ANNOTATION', mesh);
	}

	/**
	 * Deletes an annotation, given the mesh that the annotation is attached to
	 * @param mesh the mesh to delete the annotation from
	 */
	public removeAnnotationFromMesh(mesh: AbstractMesh): void {
		const rect = this.annotations.get(mesh);

		if (rect) {
			rect.dispose();
			this.annotations.delete(mesh);
			this.events.dispatch('DELETED_ANNOTATION', mesh);
		}
	}

	/**
	 * Deletes an annotation, given the name of the mesh that it is attached to; useful for deleting raw annotations
	 * @param meshName the name of the mesh to delete the annotation from
	 */
	public removeAnnotationByName(meshName: string): void {
		const mesh = this.scene.getMeshByName(meshName);

		if (mesh) {
			this.removeAnnotationFromMesh(mesh);
		} else {
			// also check if the unloaded annotations have this annotation, because there is no guarantee the name
			// is of a rendered mesh
			this.unloadedAnnotations.splice(this.unloadedAnnotations.findIndex((thisAnn) => thisAnn.mesh == meshName));
		}
	}

	/**
	 * Checks the unloaded annotations for any whose meshes have now been rendered, and renders them if necessary
	 */
	public checkAnnotations(): void {
		if (this.unloadedAnnotations.length > 0) {
			this.unloadedAnnotations.forEach((annotation, i) => {
				const mesh = this.scene.getMeshByName(annotation.mesh);
				if (mesh) {
					this.makeAnnotation(mesh, annotation.text);
					this.unloadedAnnotations.splice(i, 1);
				}
			});
		}
	}

	/**
	 * Checks all annotations for any whose mesh is no longer rendered, and disables them
	 */
	public checkVisible(): void {
		this.annotations.forEach((rect, mesh) => {
			if (!mesh.isEnabled() && this.isEnabled(rect)) {
				this.disableAnnotation(mesh);
			} else if (mesh.isEnabled() && !this.isEnabled(rect)) {
				this.enableAnnotation(mesh);
			}
		});
	}

	/**
	 * Enables the annotation of the given mesh (if it exists)
	 * @param mesh the mesh whose annotation is to be enabled
	 */
	public enableAnnotation(mesh: AbstractMesh): void {
		const rect = this.annotations.get(mesh);

		if (rect) {
			rect.isVisible = true;
		}
	}

	/**
	 * Disables the annotation of the given mesh (if it exists)
	 * @param mesh the mesh whose annotation is to be disabled
	 */
	public disableAnnotation(mesh: AbstractMesh): void {
		const rect = this.annotations.get(mesh);

		if (rect) {
			rect.isVisible = false;
		}
	}

	/**
	 * Checks if the given mesh has an annotation attached to it
	 * @param mesh the mesh to be checked
	 * @returns if the mesh has an annotation attached
	 */
	public hasAnnotation(mesh: AbstractMesh): boolean {
		return this.annotations.has(mesh);
	}

	/**
	 * Checks if the given annotation is enabled (just returns whether it's visible or not)
	 * @param ann the annotation to be checked
	 * @returns if the annotation is currently enabled
	 */
	public isEnabled(ann: Rectangle): boolean {
		return ann.isVisible;
	}
}
