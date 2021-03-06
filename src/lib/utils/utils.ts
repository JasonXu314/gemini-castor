import type BasePairSelectorModule from '../bps';
import type RadiusSelectorModule from '../radiusSelector';
import type VolumeSelectorModule from '../volumeSelector';
import { Color3, Vector3 } from './babylon';

type SelectorModule = VolumeSelectorModule | RadiusSelectorModule | BasePairSelectorModule;

/**
 * Finds the distance between the 2 points
 * @param pt1 point 1
 * @param pt2 point 2
 * @returns distance between 2 points
 */
export function distance(pt1: RawVector3, pt2: RawVector3): number {
	return Math.sqrt((pt2.x - pt1.x) ** 2 + (pt2.y - pt1.y) ** 2 + (pt2.z - pt1.z) ** 2);
}

/**
 * Finds the midpoint between 2 points (in raw form)
 * @param pt1 point 1
 * @param pt2 point 2
 * @returns midpoint of segment p1 => p2
 */
export function midpoint(pt1: RawVector3, pt2: RawVector3): RawVector3 {
	return {
		x: (pt1.x + pt2.x) / 2,
		y: (pt1.y + pt2.y) / 2,
		z: (pt1.z + pt2.z) / 2
	};
}

/**
 * Turn 3 coordinates into a bounding box for RBush
 * @param x x position
 * @param y y position
 * @param z z position
 * @param data extra data to be attached to the point
 * @returns a point, in bounding box form for insertion into RBush
 */
export function makePoint<T extends BBox>(
	x: number,
	y: number,
	z: number,
	data?: Omit<T, 'maxX' | 'minX' | 'maxY' | 'minY' | 'maxZ' | 'minZ'>
): T {
	return {
		minX: x,
		maxX: x,
		minY: y,
		maxY: y,
		minZ: z,
		maxZ: z,
		...data
	} as T;
}

/**
 * Finds the shortest array in an array of arrays, and also gives all the others (used when executing multiple sorts)
 * @param arrs arrays of anything
 * @returns a tuple, with the first element as the shortest array, and second element as all the other arrays
 */
export function findShortest<T>(...arrs: T[][]): [T[], T[][]] {
	let short: T[] = arrs[0],
		idx: number = 0;

	arrs.forEach((arr, i) => {
		if (arr.length < short.length) {
			short = arr;
			idx = i;
		}
	});

	return [short, [...arrs.slice(0, idx), ...arrs.slice(idx + 1)]];
}

/**
 * Compares 2 sorts to see if they are functionally equivalent
 * @param a the first sort
 * @param b the second sort
 * @returns true if they are equivalent
 */
export function compareSorts(a: Sort, b: Sort): boolean {
	if ((a.radSelect && !b.radSelect) || (!a.radSelect && b.radSelect)) {
		// if one is null, and the other isn't
		return false;
	}
	if (a.radSelect && b.radSelect) {
		// if neither are null, compare
		if (
			a.radSelect.position.x !== b.radSelect.position.x ||
			a.radSelect.position.y !== b.radSelect.position.y ||
			a.radSelect.position.z !== b.radSelect.position.z ||
			a.radSelect.radius !== b.radSelect.radius
		) {
			return false;
		}
	}
	if ((a.bpsSelect && !b.bpsSelect) || (!a.bpsSelect && b.bpsSelect)) {
		return false;
	}
	if (a.bpsSelect && b.bpsSelect) {
		if (a.bpsSelect.radius !== b.bpsSelect.radius || a.bpsSelect.regions !== b.bpsSelect.regions) {
			return false;
		}
	}
	if ((a.volSelect && !b.volSelect) || (!a.volSelect && b.volSelect)) {
		return false;
	}
	if (a.volSelect && b.volSelect) {
		if (
			a.volSelect.maxX !== b.volSelect.maxX ||
			a.volSelect.minX !== b.volSelect.minX ||
			a.volSelect.maxY !== b.volSelect.maxY ||
			a.volSelect.minY !== b.volSelect.minY ||
			a.volSelect.maxZ !== b.volSelect.maxZ ||
			a.volSelect.minZ !== b.volSelect.minZ
		) {
			return false;
		}
	}
	if (
		('conformSelections' in a && !('conformSelections' in b)) ||
		(!('conformSelections' in a) && 'conformSelections' in b)
	) {
		return false;
	}
	// @ts-expect-error
	if (a.conformSelections !== b.conformSelections) {
		return false;
	}
	if (
		('preserveSelections' in a && !('preserveSelections' in b)) ||
		(!('preserveSelections' in a) && 'preserveSelections' in b)
	) {
		return false;
	}
	// @ts-expect-error
	if (a.preserveSelections !== b.preserveSelections) {
		return false;
	}
	return true;
}

/**
 * Compare vectors with higher precision requirements (using ===)
 * @param v1 first vector
 * @param v2 second vector
 * @returns true if the vectors are equal
 */
export function strictCompareVectors(v1: Vector3, v2: Vector3): boolean {
	return (!v1 && !v2) || (v1 && v2 && v1.x === v2.x && v1.y === v2.y && v1.z === v2.z);
}

/**
 * Compare vectors (with some margin of error)
 * @param v1 first vector
 * @param v2 second vector
 * @returns true if the vectors are equal
 */
export function compareVectors(v1: Vector3, v2: Vector3): boolean {
	return (
		(!v1 && !v2) || (v1 && v2 && Math.abs(v1.x - v2.x) < 1 && Math.abs(v1.y - v2.y) < 1 && Math.abs(v1.z - v2.z) < 1)
	);
}

/**
 * Creates a contrasting color for the given color to indicate selection to the user
 * @param color the color to contrast
 */
export function modColor(color: Color3): Color3 {
	const { r, g, b } = color;
	const rgbTotal = r * 0.75 + g * 2 + b * 0.75;
	return new Color3(rgbTotal < 1.75 ? r * 2 : r / 2, rgbTotal < 1.75 ? g * 2 : g / 2, rgbTotal < 1.75 ? b * 2 : b / 2);
}

/**
 * Pads a number to be of length 2 (for color stuff) NOTE that num is a string of a number, not a number
 * @param num the "number" to pad
 */
export function padNum(num: string): string {
	if (num.length < 2) {
		return '0' + num;
	}
	return num;
}

/**
 * Class for handling custom events
 */
export class EventSrc<T extends Record<string, any | undefined>> {
	/**
	 * The listeners registered on this source
	 */
	private _listeners: ListenerMap<T>;

	/**
	 * Creates a new event source
	 * @param evts The events you want this to handle
	 */
	constructor(evts: (keyof T)[]) {
		this._listeners = {
			...evts.reduce((acc, evt) => {
				acc[evt] = [] as EvtListener<T[typeof evt]>[];
				return acc;
			}, {} as ListenerMap<T>)
		};
	}

	/**
	 * Adds a listener to the event
	 * @param event the event to listen to
	 * @param listener the listener to add
	 * @returns the listener
	 */
	public on<E extends keyof T>(event: E, listener: EvtListener<T[E]>): Unsubscriber {
		if (!this._listeners[event]) {
			this._listeners[event] = [];
		}

		this._listeners[event].push(listener);
		return () => {
			this._listeners[event] = this._listeners[event].filter((l) => l !== listener);
		};
	}

	/**
	 * Triggers the listeners for the event
	 * @param event the event to trigger
	 */
	public dispatch<E extends keyof T>(event: E, ...data: Parameters<EvtListener<T[E]>>): void {
		this._listeners[event].forEach((listener: T[E][0]) => (data ? listener(...data) : listener()));
	}
}

/**
 * Logging module for fancier log messages
 */
export class Logger {
	/**
	 * Creates a logger with the given name
	 * @param name the name of the module the logs are coming from
	 */
	constructor(private name: string) {}

	/**
	 * Logs a message to console
	 * @param message the main message to be logged
	 * @param args any other parts of the message
	 */
	public log(message: any, ...args: any[]): void {
		console.log(`[${this.name}]`, message, ...args);
	}

	/**
	 * Logs a message to console along with its stack trace
	 * @param message the main message to be logged
	 * @param args any other parts of the message
	 */
	public trace(message: any, ...args: any[]): void {
		console.trace(`[${this.name}]`, message, ...args);
	}

	/**
	 * Starts a timer with label ``label``
	 * @param label the label of the timer
	 */
	public time(label: string): void {
		console.time(`[${this.name}] ${label}`);
	}

	/**
	 * Ends the timer with label ``label`` and prints the output
	 * @param label the label of the timer
	 */
	public timeEnd(label: string): void {
		console.timeEnd(`[${this.name}] ${label}`);
	}
}

/**
 * Serializes the parameters in 2 selectors, used for cacheing of sort results for faster repeated performance
 * @param a the first selector
 * @param b the second selector
 * @returns a serialized string of the parameters
 */
export function serializeParams2(a: SelectorModule, b: SelectorModule): string {
	let part1: string | null = null;
	let part2: string | null = null;

	if ('maxX' in a) {
		// a is a volume selector, and should be prioritized
		part1 = `${a.maxX},${a.maxY},${a.maxZ},${a.minX},${a.minY},${a.minZ}`;
	} else if ('maxX' in b) {
		// b is a volume selector, and should be prioritized
		part2 = `${b.maxX},${b.maxY},${b.maxZ},${b.minX},${b.minY},${b.minZ}`;
	}
	if ('position' in a) {
		if (!part1) {
			// a is a radius selector, and should be prioritized
			part1 = `${a.position.x},${a.position.y},${a.position.z},${a.radius}`;
		} else {
			// but not above volume selector
			part2 = `${a.position.x},${a.position.y},${a.position.z},${a.radius}`;
		}
	} else if ('position' in b) {
		if (!part1) {
			// b is a radius selector, and should be prioritized
			part1 = `${b.position.x},${b.position.y},${b.position.z},${b.radius}`;
		} else {
			// but not above volume selector
			part2 = `${b.position.x},${b.position.y},${b.position.z},${b.radius}`;
		}
	}
	if ('regions' in a) {
		// there is already guaranteed to be a part1, so just assign the parameters to part 2 since a is a base pair selector
		part2 = `${a.regions},${a.radius}`;
	} else if ('regions' in b) {
		// same with b
		part2 = `${b.regions},${b.radius}`;
	}

	return part1 + ';' + part2;
}

/**
 * Serializes the parameters for all 3 selectors, used for cacheing of sort results for faster repeated performance
 * @param a the volume selector
 * @param b the radius selector
 * @param c the base pair selector
 * @returns a serialized string of the parameters
 */
export function serializeParams3(a: VolumeSelectorModule, b: RadiusSelectorModule, c: BasePairSelectorModule): string {
	const part1 = `${a.maxX},${a.maxY},${a.maxZ},${a.minX},${a.minY},${a.minZ}`;
	const part2 = `${b.position.x},${b.position.y},${b.position.z},${b.radius}`;
	const part3 = `${c.regions},${c.radius}`;

	return part1 + ';' + part2 + ';' + part3;
}
