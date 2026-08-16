import { Component, HostBinding, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit {
  searchTerm = '';

  @HostBinding('class.search-hidden')
  hidden = false;

  private lastScroll = 0;

  constructor(activatedRoute:ActivatedRoute,private router:Router) {
    activatedRoute.params.subscribe((params) => {
      if(params.searchTerm) this.searchTerm = params.searchTerm;
    });
   }

  ngOnInit(): void {
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (y < 80) {
      this.hidden = false;                      // always show near the top
    } else if (y > this.lastScroll + 5) {
      this.hidden = true;                       // scrolling down -> hide
    } else if (y < this.lastScroll - 5) {
      this.hidden = false;                      // scrolling up -> show
    }
    this.lastScroll = y;
  }

  search(term:string):void{
    if(term)
    this.router.navigateByUrl('/search/'+ term);
  }
}
