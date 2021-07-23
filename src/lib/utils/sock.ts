import { EventSrc, Logger } from './utils';

export default class MySocket<
	InboundMessages extends { [key: string]: SocketMsg<typeof key> },
	OutboundMessages extends { [key: string]: SocketMsg<typeof key> }
> {
	private logger: Logger;
	private _socket: WebSocket;
	private msgQueue: OutboundMessages[keyof OutboundMessages][];
	private events: EventSrc<InboundMessages>;

	constructor(url: string, msgTypes: (keyof InboundMessages)[]) {
		this._socket = new WebSocket(url);
		this.msgQueue = [];
		this.events = new EventSrc(msgTypes);
		this.logger = new Logger(`${url} Socket`);

		this._socket.addEventListener('open', () => {
			this.msgQueue.forEach((msg) => this._socket.send(JSON.stringify(msg)));
			this.msgQueue = [];
			this.logger.log('Socket Opened');
		});

		this._socket.addEventListener('message', (evt) => {
			let msg = JSON.parse(evt.data);
			// @ts-ignore no clue why ts fucks up here, but it should work nonetheless
			this.events.dispatch(msg.type, msg);
		});
	}

	public send<M extends keyof OutboundMessages>(msg: OutboundMessages[M]): void {
		if (this._socket.readyState === WebSocket.CONNECTING) {
			this.msgQueue.push(msg);
		} else if (this._socket.readyState === WebSocket.OPEN) {
			this._socket.send(JSON.stringify(msg));
		}
	}

	public on<M extends keyof InboundMessages>(msgType: M, listener: EvtListener<InboundMessages[M]>): Unsubscriber {
		return this.events.on(msgType, listener);
	}
}
