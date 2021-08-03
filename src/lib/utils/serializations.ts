export function decodeStruct(buffer: ArrayBuffer): RawStructureCoord[] {
	const coords: RawStructureCoord[] = [];
	const buf = new DataView(buffer);

	for (let i = 0; i < buf.byteLength / 13; i++) {
		const x = buf.getFloat32(i * 13, true);
		const y = buf.getFloat32(i * 13 + 4, true);
		const z = buf.getFloat32(i * 13 + 8, true);
		const compartment = buf.getInt8(i * 13 + 12) === 0 ? 'A' : 'B';

		coords.push({ x, y, z, compartment });
	}

	return coords;
}

export function decodeEpiData(buffer: ArrayBuffer): { flags: FlagTrackLite[]; arcs: ArcTrackLite[] } {
	const data: { flags: FlagTrackLite[]; arcs: ArcTrackLite[] } = {
		arcs: [],
		flags: []
	};
	const buf = new DataView(buffer);

	let idx = 0;

	const arcNames: string[] = [],
		flagNames: string[] = [];

	let arcName = '',
		flagName = '';

	while (true) {
		const char = buf.getUint8(idx);
		idx++;

		if (char === 0) {
			if (arcName === '') {
				break;
			} else {
				arcNames.push(arcName);
				arcName = '';
			}
		} else {
			arcName += String.fromCharCode(char);
		}
	}

	while (true) {
		const char = buf.getUint8(idx);
		idx++;

		if (char === 0) {
			if (flagName === '') {
				break;
			} else {
				flagNames.push(flagName);
				flagName = '';
			}
		} else {
			flagName += String.fromCharCode(char);
		}
	}

	const arcChr = buf.getInt8(idx);
	idx++;

	let arcIdx = 0;
	while (true) {
		const id = buf.getUint8(idx);
		idx++;

		if (id === 255) {
			break;
		}

		const r = buf.getUint8(idx);
		const g = buf.getUint8(idx + 1);
		const b = buf.getUint8(idx + 2);
		idx += 3;

		const track: ArcTrackLite = {
			color: { r, g, b },
			id,
			data: [],
			max: 0,
			name: arcNames[arcIdx++]
		};

		while (true) {
			const locus1Start = buf.getUint32(idx, true);
			const locus1End = buf.getUint32(idx + 4, true);
			const locus2Start = buf.getUint32(idx + 8, true);
			const locus2End = buf.getUint32(idx + 12, true);
			const score = buf.getUint16(idx + 16, true);
			const arc1StartX = buf.getFloat32(idx + 18, true);
			const arc1StartY = buf.getFloat32(idx + 22, true);
			const arc1StartZ = buf.getFloat32(idx + 26, true);
			const arc2StartX = buf.getFloat32(idx + 30, true);
			const arc2StartY = buf.getFloat32(idx + 34, true);
			const arc2StartZ = buf.getFloat32(idx + 38, true);
			const startTag1 = buf.getUint32(idx + 42, true);
			const startTag2 = buf.getUint32(idx + 46, true);
			const arc1StopX = buf.getFloat32(idx + 50, true);
			const arc1StopY = buf.getFloat32(idx + 54, true);
			const arc1StopZ = buf.getFloat32(idx + 58, true);
			const arc2StopX = buf.getFloat32(idx + 62, true);
			const arc2StopY = buf.getFloat32(idx + 66, true);
			const arc2StopZ = buf.getFloat32(idx + 70, true);
			const stopTag1 = buf.getUint32(idx + 74, true);
			const stopTag2 = buf.getUint32(idx + 78, true);
			idx += 82;

			if (
				locus1Start === 4294967295 &&
				locus1End === 4294967295 &&
				locus2Start === 4294967295 &&
				locus2End === 4294967295 &&
				score === 65535 &&
				Number.isNaN(arc1StartX) &&
				Number.isNaN(arc1StartY) &&
				Number.isNaN(arc1StartZ) &&
				Number.isNaN(arc2StartX) &&
				Number.isNaN(arc2StartY) &&
				Number.isNaN(arc2StartZ) &&
				startTag1 === 4294967295 &&
				startTag2 === 4294967295 &&
				Number.isNaN(arc1StopX) &&
				Number.isNaN(arc1StopY) &&
				Number.isNaN(arc1StopZ) &&
				Number.isNaN(arc2StopX) &&
				Number.isNaN(arc2StopY) &&
				Number.isNaN(arc2StopZ) &&
				stopTag1 === 4294967295 &&
				stopTag2 === 4294967295
			) {
				break;
			}

			if (score > track.max) {
				track.max = score;
			}
			track.data.push({
				id,
				locus1: { start: locus1Start, end: locus1End, chr: `chr${arcChr}` },
				locus2: { start: locus2Start, end: locus2End, chr: `chr${arcChr}` },
				score,
				startPos1: { x: arc1StartX, y: arc1StartY, z: arc1StartZ },
				startPos2: { x: arc2StartX, y: arc2StartY, z: arc2StartZ },
				startTag1,
				startTag2,
				stopPos1: { x: arc1StopX, y: arc1StopY, z: arc1StopZ },
				stopPos2: { x: arc2StopX, y: arc2StopY, z: arc2StopZ },
				stopTag1,
				stopTag2
			});
		}

		data.arcs.push(track);
	}

	const flagChr = buf.getUint8(idx);
	idx++;

	let flagIdx = 0;
	while (true) {
		const id = buf.getUint8(idx);
		idx++;

		if (id === 255) {
			break;
		}

		const r = buf.getUint8(idx);
		const g = buf.getUint8(idx + 1);
		const b = buf.getUint8(idx + 2);
		idx += 3;

		const track: FlagTrackLite = {
			color: { r, g, b },
			id,
			data: [],
			max: 0,
			name: flagNames[flagIdx++]
		};

		while (true) {
			const locusStart = buf.getUint32(idx, true);
			const locusEnd = buf.getUint32(idx + 4, true);
			const startX = buf.getFloat32(idx + 8, true);
			const startY = buf.getFloat32(idx + 12, true);
			const startZ = buf.getFloat32(idx + 16, true);
			const startTag = buf.getUint32(idx + 20, true);
			const stopX = buf.getFloat32(idx + 24, true);
			const stopY = buf.getFloat32(idx + 28, true);
			const stopZ = buf.getFloat32(idx + 32, true);
			const stopTag = buf.getUint32(idx + 36, true);
			const strand = buf.getUint8(idx + 40);
			const value = buf.getFloat32(idx + 41, true);
			idx += 45;

			if (
				locusStart === 4294967295 &&
				locusEnd === 4294967295 &&
				Number.isNaN(startX) &&
				Number.isNaN(startY) &&
				Number.isNaN(startZ) &&
				startTag === 4294967295 &&
				Number.isNaN(stopX) &&
				Number.isNaN(stopY) &&
				Number.isNaN(stopZ) &&
				stopTag === 4294967295 &&
				strand === 255 &&
				Number.isNaN(value)
			) {
				break;
			}

			if (value > track.max) {
				track.max = value;
			}
			track.data.push({
				id,
				locus: { start: locusStart, end: locusEnd, chr: `chr${flagChr}` },
				startPos: { x: startX, y: startY, z: startZ },
				startTag,
				stopPos: { x: stopX, y: stopY, z: stopZ },
				stopTag,
				strand: strand === 0 ? '' : 'something fucked up',
				value
			});
		}

		data.flags.push(track);
	}

	return data;
}

export function decodeRefGenes(buffer: ArrayBuffer): RawRefGene[] {
	const tracks: RawRefGene[] = [];
	const buf = new DataView(buffer);

	let idx = 0;

	while (idx < buf.byteLength) {
		// Read in ids, names, descriptions
		const ids: string[] = [],
			names: string[] = [],
			descriptions: string[] = [],
			data: RawRefGeneData[] = [];
		let id = '',
			name = '',
			description = '';

		while (true) {
			const char = buf.getUint8(idx);
			idx++;

			if (char === 0) {
				if (id === '') {
					break;
				} else {
					ids.push(id);
					id = '';
				}
			} else {
				id += String.fromCharCode(char);
			}
		}

		while (true) {
			const char = buf.getUint8(idx);
			idx++;

			if (char === 0) {
				if (name === '') {
					break;
				} else {
					names.push(name);
					name = '';
				}
			} else {
				name += String.fromCharCode(char);
			}
		}

		while (true) {
			const char = buf.getUint8(idx);
			idx++;

			if (char === 0) {
				if (description === '') {
					break;
				} else {
					descriptions.push(description);
					description = '';
				}
			} else {
				description += String.fromCharCode(char);
			}
		}

		const chr = buf.getUint8(idx);
		const geneId = buf.getUint16(idx + 1, true);
		const lowerLim = buf.getInt16(idx + 3, true);
		const upperLim = buf.getInt16(idx + 5, true);
		const colorR = buf.getUint8(idx + 7);
		const colorG = buf.getUint8(idx + 8);
		const colorB = buf.getUint8(idx + 9);
		const selected = buf.getUint8(idx + 10) === 1 ? true : false;
		const max = buf.getUint8(idx + 11);
		idx += 12;

		while (true) {
			const idIdx = buf.getUint16(idx, true);
			const id = ids[idIdx];
			const nameIdx = buf.getUint16(idx + 2, true);
			const name = names[nameIdx];
			const descriptionIdx = buf.getInt16(idx + 4, true);
			const description = descriptionIdx === -1 ? 'Gene Type: n/a Transcript Type: n/a Additional Info: n/a' : descriptions[descriptionIdx];
			const locusStart = buf.getUint32(idx + 6, true);
			const locusEnd = buf.getUint32(idx + 10, true);
			const startX = buf.getFloat32(idx + 14, true);
			const startY = buf.getFloat32(idx + 18, true);
			const startZ = buf.getFloat32(idx + 22, true);
			const startTag = buf.getUint32(idx + 26, true);
			const stopX = buf.getFloat32(idx + 30, true);
			const stopY = buf.getFloat32(idx + 34, true);
			const stopZ = buf.getFloat32(idx + 38, true);
			const stopTag = buf.getUint32(idx + 42, true);
			const stc = buf.getUint8(idx + 46);
			const strand = Math.floor(stc / 10) === 1 ? '+' : '-';
			const transcriptionClass = stc % 10 === 1 ? 'coding' : 'nonCoding';
			idx += 47;

			const transCount = buf.getInt16(idx, true);
			idx += 2;
			const _translated = transCount === 0 ? null : [];
			for (let i = 0; i < transCount; i++) {
				const start = buf.getUint32(idx, true);
				const end = buf.getUint32(idx + 4, true);
				_translated.push({ start, end });
				idx += 8;
			}

			const utrsCount = buf.getInt16(idx, true);
			idx += 2;
			const _utrs = utrsCount === 0 ? null : [];
			for (let i = 0; i < utrsCount; i++) {
				const start = buf.getUint32(idx, true);
				const end = buf.getUint32(idx + 4, true);
				_utrs.push({ start, end });
				idx += 8;
			}

			if (
				idIdx === 65535 &&
				nameIdx === 65535 &&
				descriptionIdx === -1 &&
				locusStart === 4294967295 &&
				locusEnd === 4294967295 &&
				Number.isNaN(startX) &&
				Number.isNaN(startY) &&
				Number.isNaN(startZ) &&
				startTag === 4294967295 &&
				Number.isNaN(stopX) &&
				Number.isNaN(stopY) &&
				Number.isNaN(stopZ) &&
				stopTag === 4294967295 &&
				stc === 255 &&
				transCount === -1 &&
				utrsCount === -1
			) {
				break;
			}

			data.push({
				id,
				name,
				description,
				locus: { start: locusStart, end: locusEnd, chr: `chr${chr}` },
				startPos: { x: startX, y: startY, z: startZ },
				startTag,
				stopPos: { x: stopX, y: stopY, z: stopZ },
				stopTag,
				strand,
				transcriptionClass,
				_translated,
				_utrs
			});
		}

		const newTrack: RawRefGene = {
			id: ids[geneId],
			color: colorR === 0 && colorG === 0 && colorB === 0 ? undefined : { r: colorR, g: colorG, b: colorB },
			data,
			max,
			upperLim,
			lowerLim,
			selected,
			name: 'refGene'
		};

		tracks.push(newTrack);
	}

	return tracks;
}
