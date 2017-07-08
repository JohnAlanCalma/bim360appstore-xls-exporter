// token handling in session
var token = require('./token');

// web framework
var express = require('express');
var router = express.Router();

// forge
var forgeSDK = require('forge-apis');

router.get('/dm/getTreeNode', function (req, res) {
  var tokenSession = new token(req.session);
  if (!tokenSession.isAuthorized()) {
    res.status(401).end('Please login first');
    return;
  }

  var href = decodeURIComponent(req.query.id);
  //("treeNode for " + href);

  if (href === '#') {
    // # stands for ROOT
    var hubs = new forgeSDK.HubsApi();

    hubs.getHubs({}, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials())
      .then(function (data) {
        res.json(prepareArrayForJSTree(data.body.data, true));
      })
      .catch(function (error) {
        console.log(error);
        respondWithError(res, error);
      });
  } else {
    var params = href.split('/');
    var resourceName = params[params.length - 2];
    var resourceId = params[params.length - 1];
    switch (resourceName) {
      case 'hubs':
        // if the caller is a hub, then show projects
        var projects = new forgeSDK.ProjectsApi();

        //console.log(tokenSession.getInternalOAuth());
        //console.log(tokenSession.getInternalCredentials());

        projects.getHubProjects(resourceId/*hub_id*/, {},
          tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials())
          .then(function (projects) {
            res.json(prepareArrayForJSTree(projects.body.data, true));
          })
          .catch(function (error) {
            console.log(error);
            respondWithError(res, error);
          });
        break;
      case 'projects':
        // if the caller is a project, then show folders
        var hubId = params[params.length - 3];
        var projects = new forgeSDK.ProjectsApi();
        projects.getProject(hubId, resourceId/*project_id*/,
          tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials())
          .then(function (project) {
            var rootFolderId = project.body.data.relationships.rootFolder.data.id;
            var folders = new forgeSDK.FoldersApi();
            folders.getFolderContents(resourceId, rootFolderId, {},
              tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials())
              .then(function (folderContents) {
                res.json(prepareArrayForJSTree(folderContents.body.data, true));
              })
              .catch(function (error) {
                console.log(error);
                respondWithError(res, error);
              });
          })
          .catch(function (error) {
            console.log(error);
            respondWithError(res, error);
          });
        break;
      case 'folders':
        // if the caller is a folder, then show contents
        var projectId = params[params.length - 3];
        var folders = new forgeSDK.FoldersApi();
        folders.getFolderContents(projectId, resourceId/*folder_id*/,
          {}, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials())
          .then(function (folderContents) {
            res.json(prepareArrayForJSTree(folderContents.body.data, true));
          })
          .catch(function (error) {
            console.log(error);
            respondWithError(res, error);
          });
        break;
      case 'items':
        // if the caller is an item, then show versions
        var projectId = params[params.length - 3];
        var items = new forgeSDK.ItemsApi();
        items.getItemVersions(projectId, resourceId/*item_id*/,
          {}, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials())
          .then(function (versions) {
            res.json(prepareArrayForJSTree(versions.body.data, false));
          })
          .catch(function (error) {
            console.log(error);
            respondWithError(res, error);
          });
    }
  }
});

// Formats a list to JSTree structure
function prepareArrayForJSTree(listOf, canHaveChildren, data) {
  if (listOf == null) return '';
  var treeList = [];
  listOf.forEach(function (item, index) {
    //console.log(item.links.self.href);
    //console.log(
    //  "item.attributes.displayName = " + item.attributes.displayName +
    //  "; item.attributes.name = " + item.attributes.name
    //);
    var treeItem = {
      id: item.links.self.href,
      data: (item.relationships != null && item.relationships.derivatives != null ?
        item.relationships.derivatives.data.id : null),
      text: (item.type==='versions' ? item.attributes.lastModifiedTime : item.attributes.displayName == null ? item.attributes.name : item.attributes.displayName),
      type: item.type,
      children: canHaveChildren
    };
    treeList.push(treeItem);
  });
  return treeList;
}

function respondWithError(res, error) {
  if (error.statusCode) {
    res.status(error.statusCode).end(error.statusMessage);
  } else {
    res.status(500).end(error.message);
  }
}

module.exports = router;