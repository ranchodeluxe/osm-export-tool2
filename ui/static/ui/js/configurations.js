/*
    Copyright (C) 2015  Humanitarian OpenStreetMap Team

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/


configurations = {};
configurations.list = (function(){
    var map;
    var job_extents;
    var bbox;
    var filtering = false;
    var searchForm = $('form#search');
    
    return {
        main: function(){
            // initialize the results table
            initDataTable();
            // initialize the start / end date pickers
            initDatePickers();
            // initialize the feature tag filter
            //initFeatureTagFilter();
            // initialize the search callback
            initSearch();
            // run the default search
            runSearch(); 
        },
    }
    
    
    /**
     * Lists the jobs.
     *
     * url: the search endpoint.
     *
     */
    function listConfigurations(url){
        if (!url) {
            // default search endpoint
            url = Config.CONFIGURATION_URL;
        }
        $.ajax(url)
        .done(function(data, textStatus, jqXHR){
            // generate pagination on UI
            paginate(jqXHR);
            
            // clear the existing data on results table and add new page
            var tbody = $('table#configurations tbody');
            var table = $('table#configurations').DataTable();
            table.clear();
            table.rows.add(data).draw();
            
            // set message if no results returned from this url..
            $('td.dataTables_empty').html('No configuration files found.'); 
        });
    }
    
    /*
     * Creates the pagination links based on the Content-Range and Link headers.
     *
     * jqXHR: the ajax xhr
     */
    function paginate(jqXHR){
        
        // get the pagination ul
        var paginate = $('ul.pager');
        paginate.empty();
        var info = $('#info');
        info.empty();
        
        // set the content range info
        var rangeHeader = jqXHR.getResponseHeader('Content-Range');
        var total = rangeHeader.split('/')[1];
        var range = rangeHeader.split('/')[0].split(' ')[1];
        info.append('<span>Displaying ' + range + ' of ' + total + ' results');
        
        // check if we have a link header
        var a, b;
        var link = jqXHR.getResponseHeader('Link');
        if (link) {
            var links = link.split(',');
            a = links[0];
            b = links[1];
        }
        else {
            // no link header so only one page of results returned
            return;
        }
        
        /*
         * Configure next/prev links for pagination
         * and handle pagination events
         */
        if (b) {
            var url = b.split(';')[0].trim();
            url = url.slice(1, url.length -1);
            var rel = b.split(';')[1].split('=')[1];
            rel = rel.slice(1, rel.length -1);
            paginate.append('<li id="prev" data-url="' + url + '"><a href="#"><span class="glyphicon glyphicon-chevron-left"/> Prev</a></li>&nbsp;');
            $('li#prev').on('click', function(){
                var u = this.getAttribute('data-url');
                u == 'undefined' ? listConfigurations() : listConfigurations(u);  
            });
        }
        
        if (a) {
            var url = a.split(';')[0].trim();
            url = url.slice(1, url.length -1);
            var rel = a.split(';')[1].split('=')[1];
            rel = rel.slice(1, rel.length -1);
            if (rel == 'prev') {
                paginate.append('<li id="prev" data-url="' + url + '"><a href="#"><span class="glyphicon glyphicon-chevron-left"/> Prev</a></li>');
                $('li#prev').on('click', function(){
                    var u = this.getAttribute('data-url');
                    u == 'undefined' ? listConfigurations() : listConfigurations(u);
                });
            }
            else {
                paginate.append('<li id="next" data-url="' + url + '"><a href="#">Next <span class="glyphicon glyphicon-chevron-right"/></a></li>');
                $('li#next').on('click', function(){
                    var u = this.getAttribute('data-url');
                    u == 'undefined' ? listConfigurations() : listConfigurations(u);
                });
            }
        }
    }
    
    /*
     * Initialize the configuration list data table.
     */
    function initDataTable(){
        $('table#configurations').DataTable({
            paging: false,
            info: false,
            filter: false,
            searching: false,
            columns: [
                {data: 'name'},
                {data: 'config_type'},
                {
                    data: 'created',
                    render: function(data, type, row){
                        return moment(data).format('YYYY-MM-DD HH:MM');
                    }
                },
                {
                    data: 'filename',
                    render: function(data, type, row){
                        return '<a href="' + row.upload + '" target="_blank">' + data + '</a>';
                    }
                }
            ]
           });
        // clear the empty results message on initial draw..
        $('td.dataTables_empty').html('');
    }
    
    /**
     * Initialize the start / end date pickers.
     */
    function initDatePickers(){
        $('#start-date').datetimepicker({
            showTodayButton: true,
            // show one month of exports by default
            defaultDate: moment().subtract(1, 'month'),
            format: 'YYYY-MM-DD HH:MM'
        });
        $('#end-date').datetimepicker({
            showTodayButton: true,
            // default end-date to now.
            defaultDate: moment(),
            format: 'YYYY-MM-DD HH:MM'
        });
        $("#start-date").on("dp.change", function(e){
            runSearch();
        });
        $("#end-date").on("dp.change", function(e){
            runSearch();
        });
        
    }
    
    /**
     * Initializes the feature tag filter.
     */
    function initFeatureTagFilter() {
        
        var cities = new Bloodhound({
            /*
            datumTokenizer: function(d) {
                return Bloodhound.tokenizers.whitespace(d.value); 
            },
            */
            datumTokenizer: Bloodhound.tokenizers.whitespace,
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            prefetch: {
                url: Config.HDM_TAGS_URL,
                /*
                filter: function(data) {
                    return $.map(data, function(str) {
                        return { value: str };
                    });
                },
                */
            }
        });
        
        $('#features').tagsinput({
            typeaheadjs: {
              name: 'cities',
              displayKey: 'value',
              valueKey: 'value',
              source: cities.ttAdapter()
            }
        });
        
        
        function lookupOSMTags(q, sync) {
            console.log('in lookup...')
            if (q === '') {
                sync(osm_tags.get('Detroit Lions', 'Green Bay Packers', 'Chicago Bears'));
            }
            else {
                osm_tags.search(q, sync);
            }
        }

        var input = $('input#features');
        /*
        tgsinput.tagsinput({
            typeaheadjs: {
                name: 'tags',
                displayKey: 'name',
                valueKey: 'name',
                source: tags.ttAdapter()
            }
        });
        */
        
        $(".twitter-typeahead").css('display', 'inline');
    }
    
    /*
     * Search export jobs.
     */ 
    function initSearch(){
        // update state on filter toggle button
        $('a#filter-toggle').click(function(e){
            $(e.target).children("i.indicator").toggleClass(
                'glyphicon-chevron-down glyphicon-chevron-up'
            );
        });
        
        // run search on search form input events
        $('form#search input').bind('input', function(e){
            runSearch();
        });
        
        // run search on selection changes
        $('select').bind('change', function(e){
           runSearch(); 
        });
        
        // run search on user filtering state change
        $('input#user-check').bind('click', function(e){
            // pull the username out of the dom
            var username = $('span#user').text();
            var $this = $(this);
            // $this will contain a reference to the checkbox   
            if ($this.is(':checked')) {
                // set the username on the form input
                $('input#user').val(username);
                runSearch(); 
            } else {
                $('input#user').val('');
                runSearch();
            }
        });
    }
    
    /*
     * Runs a search.
     * Takes query params from serialized form inputs.
     */
    function runSearch(){
        var url = Config.CONFIGURATION_URL + '?';
        url += searchForm.serialize();
        listConfigurations(url); // update results table
    }
    
}());


$(document).ready(function() {
    // initialize the app..
    configurations.list.main();
});
