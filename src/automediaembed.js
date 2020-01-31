/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module media-embed/automediaembed
 */

import MediaEmbedEditing from './mediaembedediting';
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { keyCodes } from '@ckeditor/ckeditor5-utils/src/keyboard';
import LiveRange from '@ckeditor/ckeditor5-engine/src/model/liverange';
import LivePosition from '@ckeditor/ckeditor5-engine/src/model/liveposition';
import { insertMedia } from './utils';

const URL_REGEXP = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=]+$/;

/**
 * The auto-media embed plugin. It recognizes media links in the pasted content and embeds
 * them shortly after they are injected into the document.
 *
 * @extends module:core/plugin~Plugin
 */
export default class AutoMediaEmbed extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'AutoMediaEmbed';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const view = this.editor.editing.view;
		const viewDocument = view.document;

		this.listenTo( viewDocument, 'keydown', ( eventInfo, domEventData ) => {
			const keyCode = domEventData.keyCode;
			if ( keyCode == keyCodes.enter ) {
				if ( this._embedMedia() ) {
					domEventData.preventDefault();
					eventInfo.stop();
				}
			}
		}, { priority: 'high' } );
	}

	_embedMedia() {
		const rightPosition = this.editor.model.document.selection.focus;
		const leftPosition = this.editor.model.document.selection.focus;
		const leftLivePosition = LivePosition.fromPosition( leftPosition );
		leftLivePosition.offset = 0;
		leftLivePosition.stickiness = 'toPrevious';
		const rightLivePosition = LivePosition.fromPosition( rightPosition );
		rightLivePosition.stickiness = 'toNext';

		const editor = this.editor;
		const mediaRegistry = editor.plugins.get( MediaEmbedEditing ).registry;

		const urlRange = new LiveRange( leftLivePosition, rightLivePosition );
		const walker = urlRange.getWalker( { ignoreElementEnd: true } );

		let url = '';

		for ( const node of walker ) {
			if ( node.item.is( 'textProxy' ) ) {
				url += node.item.data;
			}
		}

		url = url.trim();

		let embedded = true;

		// If the URL does not match to universal URL regexp, let's skip that.
		if ( !url.match( URL_REGEXP ) ) {
			embedded = false;
		}

		// If the URL represents a media, let's use it.
		if ( !mediaRegistry.hasMedia( url ) ) {
			embedded = false;
		}

		const mediaEmbedCommand = editor.commands.get( 'mediaEmbed' );

		// Do not anything if media element cannot be inserted at the current position (#47).
		if ( !mediaEmbedCommand.isEnabled ) {
			embedded = false;
		}

		if ( embedded ) {
			editor.model.change( writer => {
				insertMedia( editor.model, url, leftLivePosition );
				writer.setSelection( urlRange );
				writer.remove( urlRange );
				writer.setSelection( rightLivePosition );
			} );
		}

		leftLivePosition.detach();
		rightLivePosition.detach();

		return embedded;
	}
}
