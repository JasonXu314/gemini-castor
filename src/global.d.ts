/// <reference types="@sveltejs/kit" />

type Mesh = import('babylonjs').Mesh;
type BBox = import('rbush-3d').BBox;

type EvtListener<T = undefined> = T extends undefined ? () => void : (evt: T) => void;
type Unsubscriber = () => void;
type ListenerMap<T extends Record<string, any>> = {
	[event in keyof T]: EvtListener<T[event]>[];
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
	gltf: string;
	bin: string;
	textures: string[];
	modelData: ModelData;
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
	name: string;
	radSelect: RadSelectParams | null;
	volSelect: VolSelectParams | null;
	bpsSelect: BPSParams | null;
}

interface MainEvents {
	RECALL_SORT: Sort;
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
		arcs: RawArcTrackData[];
		flags: RawFlagTrackData[];
	};
	refGenes: RawRefGene[];
	viewRegion: ViewRegion;
	flagsVisible: boolean;
	arcsVisible: boolean;
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
	annotation: string | null;
}

interface ABushData extends BaseBushData {
	raw: RawArcTrackData;
	annotation: string | null;
}

interface FlagTrackLite {
	data: RawFlagTrackData[];
	max: number;
	color: RawColor3;
}

interface ArcTrackLite {
	data: RawArcTrackData[];
	max: number;
	color: RawColor3;
}