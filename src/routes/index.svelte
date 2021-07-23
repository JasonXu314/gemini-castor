<script lang="ts">
	import { BACKEND_URL } from '$lib/utils/constants';
	import axios from 'axios';
	import { onMount } from 'svelte';

	onMount(() => {
		axios.post(`${BACKEND_URL}/wakeup`, null, { timeout: 5000 }).then().catch();
	});
</script>

<div>
	<div>This is just a placeholder page :)</div>
	<div>Visit our <a href="/share">gallery</a> to see all the models others have created!</div>
</div>
