/// <reference types="@sveltejs/kit" />

type Mesh = import('babylonjs').Mesh;
type Engine = import('babylonjs').Engine;
type LinesMesh = import('babylonjs').LinesMesh;
type SceneOptimizer = import('babylonjs').SceneOptimizer;
type Scene = import('babylonjs').Scene;
type UniversalCamera = import('babylonjs').UniversalCamera;
type HemisphericLight = import('babylonjs').HemisphericLight;
type AbstractMesh = import('babylonjs').AbstractMesh;
type StandardMaterial = import('babylonjs').StandardMaterial;
type Vector3 = import('babylonjs').Vector3;
type Color3 = import('babylonjs').Color3;
type CloudPoint = import('babylonjs').CloudPoint;
type PointsCloudSystem = import('babylonjs').PointsCloudSystem;
type AdvancedDynamicTexture = import('babylonjs-gui').AdvancedDynamicTexture;
type Rectangle = import('babylonjs-gui').Rectangle;
type TextBlock = import('babylonjs-gui').TextBlock;
type BBox = import('rbush-3d').BBox;

type EvtListener<T = undefined> = T extends undefined ? () => void : (evt: T) => void;
type Unsubscriber = () => void;
type ListenerMap<T extends Record<string, any>> = {
	[event in keyof T]: EvtListener<T[event]>[];
};

type EpiDataFeature = SelectedFlag | SelectedArc;
type RawHighlight = RadiusHighlight | VolumeHighlight;

type SocketReceiveMsgs = {
	HIST_ADD: { type: 'HIST_ADD'; newSort: Sort };
	HIST_DEL: { type: 'HIST_DEL'; id: string };
	HIST_EDIT: { type: 'HIST_EDIT'; id: string; name: string };
	HIGHLIGHT_ADD: { type: 'HIGHLIGHT_ADD'; newHighlight: RawHighlight };
	HIGHLIGHT_DEL: { type: 'HIGHLIGHT_DEL'; id: string };
	HIGHLIGHT_EDIT: { type: 'HIGHLIGHT_EDIT'; id: string; name: string };
	VIEW_ADD: { type: 'VIEW_ADD'; newView: View };
	VIEW_DEL: { type: 'VIEW_DEL'; id: string };
	VIEW_EDIT: { type: 'VIEW_EDIT'; id: string; name: string };
	ANN_ADD: { type: 'ANN_ADD'; newAnnotation: RawAnnotation };
	ANN_DEL: { type: 'ANN_DEL'; mesh: string };
	START_LIVE: { type: 'START_LIVE'; data: LiveSessionData };
	JOIN_LIVE: { type: 'JOIN_LIVE'; id: string; name: string };
	LEAVE_LIVE: { type: 'LEAVE_LIVE'; id: string };
	CAM_CHANGE: { type: 'CAM_CHANGE'; camPos: RawVector3; camRot: RawVector3 };
	END_LIVE: { type: 'END_LIVE' };
	SELECT_MESH: { type: 'SELECT_MESH'; mesh: string };
	TRANSFER_CONTROL: { type: 'TRANSFER_CONTROL'; id: string };
	REQUEST_CONTROL: { type: 'REQUEST_CONTROL'; id: string; name: string };
};

type SocketSendMsgs = {
	LINK: { type: 'LINK'; id: string; roomId: string };
	START_LIVE: { type: 'START_LIVE'; camPos: RawVector3; camRot: RawVector3; name: string };
	JOIN_LIVE: { type: 'JOIN_LIVE'; name: string };
	LEAVE_LIVE: { type: 'LEAVE_LIVE' };
	END_LIVE: { type: 'END_LIVE' };
	CAM_CHANGE: { type: 'CAM_CHANGE'; camPos: RawVector3; camRot: RawVector3 };
	SELECT_MESH: { type: 'SELECT_MESH'; mesh: string };
	TRANSFER_CONTROL: { type: 'TRANSFER_CONTROL'; id: string };
	REVERT_CONTROL: { type: 'REVERT_CONTROL' };
	REQUEST_CONTROL: { type: 'REQUEST_CONTROL'; id: string };
};

interface RawVector3 {
	x: number;
	y: number;
	z: number;
}

interface Locus {
	start: number;
	end: number;
	chr: `chr${number}`;
}

interface RawColor3 {
	r: number;
	g: number;
	b: number;
}

interface ModelData {
	viewRegion: ViewRegion;
	flagsVisible: boolean;
	arcsVisible: boolean;
}

interface Model {
	_id: string;
	name: string;
	modelData: ModelData;
	sortHist: Sort[];
	annotations: RawAnnotation[];
	highlights: RawHighlight[];
	views: View[];
	live: boolean;
	session: null | LiveSessionData;
}

interface RadSelectParams {
	position: RawVector3;
	radius: number;
}

interface VolSelectParams {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
}

interface BPSParams {
	regions: string;
	radius: number;
}

interface Sort {
	_id: string;
	name: string;
	radSelect: RadSelectParams | null;
	volSelect: VolSelectParams | null;
	bpsSelect: BPSParams | null;
}

interface RawStructureCoord extends RawVector3 {
	compartment: 'A' | 'B';
}

interface RawArcTrackData {
	id: number;
	locus1: Locus;
	locus2: Locus;
	score: number;
	startPos1: RawVector3;
	startPos2: RawVector3;
	startTag1: number;
	startTag2: number;
	stopPos1: RawVector3;
	stopPos2: RawVector3;
	stopTag1: number;
	stopTag2: number;
}

interface RawFlagTrackData {
	id: number;
	locus: Locus;
	startPos: RawVector3;
	startTag: number;
	stopPos: RawVector3;
	stopTag: number;
	strand: string;
	value: number;
}

interface RawEpiData {
	arcs: ArcTrackLite[];
	flags: FlagTrackLite[];
}

interface RenderEpiData {
	arcs: RawArcTrackData[];
	flags: RawFlagTrackData[];
}

interface RawRefGene {
	id: string;
	name: string;
	data: RawRefGeneData[];
	max: number;
	color: RawColor3;
	upperLim: number;
	lowerLim: number;
	selected: boolean;
}

interface RawRefGeneData {
	id: string;
	name: string;
	description: string;
	locus: Locus;
	startPos: RawVector3;
	startTag: number;
	stopPos: RawVector3;
	stopTag: number;
	strand: '-' | '+';
	transcriptionClass: 'nonCoding' | 'coding';
	_translated: null | { start: number; end: number }[];
	_utrs: null | { start: number; end: number }[];
}

interface ViewRegion {
	genomeStart: number;
	start: number;
	stop: number;
	length: number;
	chrLength: number;
	chr: number;
}

interface RawGameMetadata {
	structure: RawStructureCoord[];
	epiData: {
		arcs: ArcTrackLite[];
		flags: FlagTrackLite[];
	};
	refGenes: RawRefGene[];
	viewRegion: ViewRegion;
	flagsVisible: boolean;
	arcsVisible: boolean;
	id: string;
}

interface BaseBushData {
	minX: number;
	minY: number;
	minZ: number;
	maxX: number;
	maxY: number;
	maxZ: number;
}

interface SBushData extends BaseBushData {
	compartment: 'A' | 'B';
	sorted: boolean;
	raw: RawStructureCoord;
}

interface FBushData extends BaseBushData {
	raw: RawFlagTrackData;
}

interface ABushData extends BaseBushData {
	raw: RawArcTrackData;
}

interface FlagTrackLite {
	data: RawFlagTrackData[];
	max: number;
	color: RawColor3;
	id: number;
	name: string;
}

interface ArcTrackLite {
	data: RawArcTrackData[];
	max: number;
	color: RawColor3;
	id: number;
	name: string;
}

interface RawAnnotation {
	mesh: string;
	text: string;
}

interface RenderedArc {
	lines: Mesh;
	cubes: Mesh[];
	tris: Mesh[];
	enabled: boolean;
}

interface SocketMsg<T extends string> {
	type: T;
}

interface SelectedFlag {
	type: 'flag';
	data: RawFlagTrackData;
	track: number;
	mesh: AbstractMesh;
}

interface SelectedArc {
	type: 'arc';
	data: RawArcTrackData;
	track: number;
	mesh: AbstractMesh;
}

interface HistoryContext {
	renameSort: (sort: Sort) => void;
	deleteSort: (sort: Sort) => void;
}

interface ViewContext {
	renameView: (view: View) => void;
	deleteView: (view: View) => void;
}

interface LiveParticipant {
	id: string;
	name: string;
}

interface LiveSessionData {
	hostID: string;
	controllerID: string;
	camPos: RawVector3;
	camRot: RawVector3;
	participants: LiveParticipant[];
}

interface View {
	_id: string;
	name: string;
	pos: RawVector3;
	rot: RawVector3;
}

interface RadiusHighlight {
	id: string;
	name: string;
	params: RadSelectParams;
	type: 'radius';
}

interface VolumeHighlight {
	id: string;
	name: string;
	params: VolSelectParams;
	type: 'volume';
}
