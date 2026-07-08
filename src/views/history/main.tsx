import { StrictMode, useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom";

import CommitsTable from "./components/CommitsTable/CommitsTable";

import { ChannelContext, initializeChannel } from "./data/channel";

import "@vscode/codicons/dist/codicon.css";
import "./main.scss";

function App() {
	const channel = useContext(ChannelContext)!;

	const [isRepoInitialized, setIsRepoInitialized] = useState(false);

	useEffect(() => {
		channel.getDefaultRepository().then((defaultRepo) => {
			!!defaultRepo && setIsRepoInitialized(true);
		});

		channel.onReposChange((repos) => {
			!!repos?.length && setIsRepoInitialized(true);
		});
	}, [channel]);

	return isRepoInitialized ? <CommitsTable /> : null;
}

async function render() {
	const channel = await initializeChannel();

	ReactDOM.render(
		<StrictMode>
			<ChannelContext.Provider value={channel}>
				<App />
			</ChannelContext.Provider>
		</StrictMode>,
		document.getElementById("root")
	);
}

render();
