<script lang="ts">
	export let type: 'action' | 'cancel';
	export let disabled: boolean = false;
</script>

<button on:click {disabled} class={'btn ' + type}><slot /></button>

<style>
	.btn {
		color: white;
		border: 2px solid;
		padding: 0.5em;
		border-radius: 0.5em;
		cursor: pointer;
		margin-bottom: 0.2em;
	}

	.cancel {
		background-color: rgb(160, 48, 48);
		border-color: rgb(128, 32, 32);
	}

	.action {
		background-color: rgb(48, 160, 48);
		border-color: rgb(32, 128, 32);
	}

	.cancel:hover:not(:disabled) {
		background-color: rgb(80, 24, 24);
	}

	.action:hover:not(:disabled) {
		background-color: rgb(24, 80, 24);
	}
</style>
