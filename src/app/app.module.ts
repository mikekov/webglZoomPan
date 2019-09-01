import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { WaferMapComponent } from './wafer-map/wafer-map.component';
import { ScrollbarComponent } from './scrollbar/scrollbar.component';
import { SplitterDirective } from './splitter/splitter.directive';

@NgModule({
	declarations: [
		AppComponent,
		WaferMapComponent,
		ScrollbarComponent,
		SplitterDirective
	],
	imports: [
		BrowserModule
	],
	providers: [],
	bootstrap: [AppComponent]
})
export class AppModule { }
