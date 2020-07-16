import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { WaferMapComponent } from './wafer-map/wafer-map.component';
import { ScrollbarComponent } from './scrollbar/scrollbar.component';
import { SplitterDirective } from './splitter/splitter.directive';
import { TwoDViewerComponent } from './two-d-viewer/two-d-viewer.component';

@NgModule({
	declarations: [
		AppComponent,
		WaferMapComponent,
		ScrollbarComponent,
		SplitterDirective,
		TwoDViewerComponent
	],
	imports: [
		BrowserModule, HttpClientModule
	],
	providers: [],
	bootstrap: [AppComponent]
})
export class AppModule { }
