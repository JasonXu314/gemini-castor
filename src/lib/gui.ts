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

	public loadAnnotations(annotations: RawAnnotation[]): void {
		annotations.forEach((ann) => this.loadAnnotation(ann));
	}

	public loadAnnotation(annotation: RawAnnotation): void {
		const mesh = this.scene.getMeshByName(annotation.mesh);

		if (!mesh) {
			this.unloadedAnnotations.push(annotation);
		} else if (!this.hasAnnotation(mesh)) {
			this.makeAnnotation(mesh, annotation.text);
		}
	}

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

	public removeAnnotationFromMesh(mesh: AbstractMesh): void {
		const rect = this.annotations.get(mesh);

		if (rect) {
			rect.dispose();
			this.annotations.delete(mesh);
			this.events.dispatch('DELETED_ANNOTATION', mesh);
		}
	}

	public removeAnnotationByName(meshName: string): void {
		const mesh = this.scene.getMeshByName(meshName);

		if (mesh) {
			this.removeAnnotationFromMesh(mesh);
		} else {
			this.unloadedAnnotations.splice(this.unloadedAnnotations.findIndex((thisAnn) => thisAnn.mesh == meshName));
		}
	}

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

	public checkVisible(): void {
		this.annotations.forEach((rect, mesh) => {
			if (!mesh.isEnabled() && this.isEnabled(rect)) {
				this.disableAnnotation(mesh);
			} else if (mesh.isEnabled() && !this.isEnabled(rect)) {
				this.enableAnnotation(mesh);
			}
		});
	}

	public enableAnnotation(mesh: AbstractMesh): void {
		const rect = this.annotations.get(mesh);

		if (rect) {
			rect.isVisible = true;
		}
	}

	public disableAnnotation(mesh: AbstractMesh): void {
		const rect = this.annotations.get(mesh);

		if (rect) {
			rect.isVisible = false;
		}
	}

	public hasAnnotation(mesh: AbstractMesh): boolean {
		return this.annotations.has(mesh);
	}

	public isEnabled(ann: Rectangle): boolean {
		return ann.isVisible;
	}
}
